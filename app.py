"""比赛获奖排名工具 - Flask 应用入口

仅提供静态页面路由与资源托管服务，不处理业务逻辑、不存储任何业务数据。
所有业务计算与数据存储完全由前端实现。
"""

from flask import Flask, send_from_directory
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")

app = Flask(__name__, static_folder=STATIC_DIR, static_url_path="/static")


@app.route("/")
def index():
    """返回单页应用入口"""
    return send_from_directory(STATIC_DIR, "index.html")


if __name__ == "__main__":
    # 默认监听 0.0.0.0:5000，便于手机端通过局域网访问
    app.run(host="0.0.0.0", port=5000, debug=True)
