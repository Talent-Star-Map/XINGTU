# 本地 Docker 开发

前后端在本机 Docker 运行，源码挂载支持热更新。MySQL、Neo4j、MongoDB通过团队SSH通道使用新服务器数据库，不启动本地数据库服务。

先按 `deploy/team-access` 完成当前电脑的连接配置，启动 Docker Desktop，然后在仓库根目录执行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File deploy/docker-dev/Start.ps1
```

网页：http://localhost:3000 。后端：http://localhost:8082/docs 。服务器已部署网页仍使用13000端口。

后端复用本机 `xingtu-api:latest` 依赖镜像，源码实时挂载。首次没有该镜像，或Python依赖变更时，先执行 `docker build -t xingtu-api:latest backend`。前端依赖安装在独立Docker卷中，依赖变更后在前端容器中执行 `npm ci`。当前开发配置的后端监听routers和services目录，顶层文件更改后可重启api服务。

私有配置自动从当前电脑 `.xingtu-access/backend.env` 生成到被Git忽略的 `tmp/docker-dev.env`，不包含在镜像构建上下文中。现有backend/.env的外部服务配置会被保留，数据库地址及本地JWT由团队连接配置覆盖。Docker中使用host.docker.internal连接Windows上的13308、17687、37017三个隧道端口。

开发模式跳过自动建表。操作页面仍会读写云数据库中的实际业务数据。SSH通道必须保持连接。

停止应用：

```powershell
docker compose -f deploy/docker-dev/compose.yaml stop
```
