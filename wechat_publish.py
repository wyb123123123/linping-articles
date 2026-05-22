#!/usr/bin/env python3
"""
临平数协公众号推文自动发布脚本
功能：上传配图 → 创建草稿 → 推送到公众号草稿箱
"""
import json
import os
import sys
import time
import requests

# ==================== 配置 ====================
CONFIG_PATH = os.path.expanduser("~/.workbuddy/wechat/config.json")
BASE_URL = "https://api.weixin.qq.com"
AUTHOR = "杭州市临平区数据产业协会"

def load_config():
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def get_access_token(appid, secret):
    """获取 access_token，带缓存"""
    cache_file = os.path.expanduser("~/.workbuddy/wechat/token_cache.json")
    
    # 检查缓存
    if os.path.exists(cache_file):
        with open(cache_file, "r") as f:
            cache = json.load(f)
        if cache.get("expires_at", 0) > time.time():
            return cache["token"]
    
    # 请求新 token
    url = f"{BASE_URL}/cgi-bin/token"
    params = {"grant_type": "client_credential", "appid": appid, "secret": secret}
    resp = requests.get(url, params=params, timeout=15)
    data = resp.json()
    
    if "access_token" not in data:
        raise Exception(f"获取access_token失败: {data}")
    
    # 缓存（提前5分钟过期）
    cache = {
        "token": data["access_token"],
        "expires_at": time.time() + data.get("expires_in", 7200) - 300
    }
    with open(cache_file, "w") as f:
        json.dump(cache, f)
    
    return data["access_token"]

def upload_image(token, image_path):
    """上传图片作为永久素材，返回 media_id"""
    url = f"{BASE_URL}/cgi-bin/material/add_material"
    params = {"access_token": token, "type": "image"}
    
    with open(image_path, "rb") as f:
        files = {"media": (os.path.basename(image_path), f, "image/png")}
        resp = requests.post(url, params=params, files=files, timeout=30)
    
    data = resp.json()
    if "media_id" not in data:
        raise Exception(f"上传图片失败: {data}")
    return data["media_id"], data.get("url", "")

def create_draft(token, title, content, thumb_media_id, digest=""):
    """创建公众号草稿"""
    url = f"{BASE_URL}/cgi-bin/draft/add"
    params = {"access_token": token}
    
    if not digest:
        # 自动生成摘要：取正文前100字
        import re
        clean = re.sub(r"<[^>]+>", "", content)
        clean = re.sub(r"\s+", "", clean)
        digest = clean[:100] + "…"
    
    body = {
        "articles": [{
            "title": title,
            "author": AUTHOR,
            "digest": digest,
            "content": content,
            "content_source_url": "",
            "thumb_media_id": thumb_media_id,
            "need_open_comment": 0,
            "only_fans_can_comment": 0,
            "pic_crop": {"left": 0, "right": 1, "top": 0, "bottom": 1}
        }]
    }
    
    resp = requests.post(url, params=params, json=body, timeout=30)
    data = resp.json()
    
    if "media_id" not in data:
        raise Exception(f"创建草稿失败: {data}")
    return data["media_id"]

def publish_article(article_html_path, image_path):
    """完整发布流程：上传图片 → 创建草稿"""
    config = load_config()
    token = get_access_token(config["appid"], config["appsecret"])
    
    print(f"[1/3] 获取 access_token 成功")
    
    # 上传配图
    media_id, media_url = upload_image(token, image_path)
    print(f"[2/3] 上传配图成功, media_id: {media_id}")
    
    # 读取文章HTML
    with open(article_html_path, "r", encoding="utf-8") as f:
        html_content = f.read()
    
    # 提取标题
    import re
    title_match = re.search(r"<h1[^>]*class=\"article-title\"[^>]*>(.*?)</h1>", html_content)
    title = title_match.group(1).strip() if title_match else "临平数协推文"
    
    # 创建草稿
    draft_media_id = create_draft(token, title, html_content, media_id)
    print(f"[3/3] 草稿创建成功, media_id: {draft_media_id}")
    
    return {
        "title": title,
        "draft_media_id": draft_media_id,
        "cover_media_id": media_id,
        "cover_url": media_url
    }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python wechat_publish.py <article_html_path> [image_path]")
        sys.exit(1)
    
    html_path = sys.argv[1]
    img_path = sys.argv[2] if len(sys.argv) > 2 else None
    
    if not os.path.exists(html_path):
        print(f"Error: 文章文件不存在: {html_path}")
        sys.exit(1)
    
    try:
        result = publish_article(html_path, img_path)
        print(f"\n✅ 发布成功！")
        print(f"   标题: {result['title']}")
        print(f"   草稿ID: {result['draft_media_id']}")
        print(f"   状态: 已推送到公众号草稿箱，请在后台审核后群发")
    except Exception as e:
        print(f"\n❌ 发布失败: {e}")
        sys.exit(1)
