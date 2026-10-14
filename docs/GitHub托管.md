# GitHub Pages 静态回放

运行 `python backend/export_static.py` 生成 `site/`：每局独立 JSON、比赛目录和本地素材。浏览器选择比赛时只下载该局，不加载原始 SQLite。所有路径兼容 `https://用户名.github.io/仓库名/`。

本地检查：`python -m http.server 8766 --directory site`，访问 `http://127.0.0.1:8766/`。

发布方式：将 site 内文件提交到目标 GitHub 仓库的发布分支根目录，在仓库 Settings → Pages 选择该分支和根目录。也可由现有站点的发布流程复制到回放子目录。无需部署 Python 后端。

原始数据库不进入发布仓库。发布前确认数据及官方素材允许公开分发并保留来源说明；网站说明其为独立数据回放项目。

GitHub Pages 已发布站点上限 1 GB，见 https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits 。完整导出后以实际体积决定是否需要进一步压缩或分离数据托管。

当前未创建仓库、推送或发布，尚未指定目标 GitHub 仓库。
