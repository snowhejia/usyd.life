# USYD EVENTS WALL · 悉大活动墙

由学生共同维护的悉尼大学校园指南。前端为 HTML、CSS 和 JavaScript；Node.js 提供网页、访客统计、独立点赞及评论读取接口，统计和点赞保存在 SQLite 中。内容投稿、留言和详情评论通过 GitHub Issues 保存。无需安装第三方运行时包。

## 本地运行

安装 Node.js 24.15 或更新的 24.x 版本，在项目根目录执行：

```sh
npm start
```

打开 http://127.0.0.1:4173/ 。无需前端构建或 `npm install`。默认数据库是 `.data/stats.sqlite3`，首次启动自动创建；之后启动继续使用已有数据。不要用静态文件服务器代替此启动命令，否则统计和点赞接口不可用。

```sh
npm run check  # 检查内容、标签和资源引用
npm test       # 首页推荐、统计、独立点赞、GitHub 评论缓存、持久化和 HTTP 接口测试
npm run test:home # 首页随机推荐与到期边界测试
```

## 部署到 Railway

仓库：[snowhejia/usyd.life](https://github.com/snowhejia/usyd.life)。网页与 `/api/` 由同一服务和域名提供，无需单独部署前端。

1. 在 Railway 新建项目，选择 **Deploy from GitHub repo**，连接 `snowhejia/usyd.life` 的 `main` 分支。
2. 保持根目录为仓库根目录，Railway 会识别 `Dockerfile`。无需设置前端构建命令或额外的启动命令。
3. 给该服务添加持久卷，挂载路径 **`/data`**。保持单实例运行；SQLite 不支持多个独立实例共用各自的数据目录。
4. 健康检查设置为 **`/api/health`**。在 Networking 中生成公开域名。
5. 将 `PUBLIC_ORIGIN` 设置为实际公开地址，例如 `https://your-service.up.railway.app`。使用自定义域名时同步更新此值，并把其他域名重定向到该地址。
6. 部署成功后，打开首页及任一详情，检查统计、点赞与评论。以后 `main` 更新会由 Railway 的 GitHub 自动部署发布。

容器使用 Node.js 24，监听平台注入的 `PORT`；默认 `3000`。入口脚本先处理持久卷权限，再以普通用户启动应用。无需安装第三方 Node.js 运行时包。

| 变量 | 用途 |
| --- | --- |
| `HOST` | Docker 已设为 `0.0.0.0`；本地默认 `127.0.0.1` |
| `PORT` | 使用 Railway 提供的端口；本地默认 `4173` |
| `DATA_DIR` | Docker 已设为 `/data`，必须与持久卷挂载路径一致 |
| `PUBLIC_ORIGIN` | 实际公网地址，用于校验 API 请求来源 |
| `GITHUB_READ_TOKEN` | 可选；仅用于服务端读取公开 Issue 评论，减少未登录 API 限流；如配置细粒度 Token，只给本仓库 Issues 读取权限 |

没有 `GITHUB_READ_TOKEN` 也能读取公开评论。服务端会缓存结果、合并同时发起的请求，并在临时故障时展示上次同步结果。Token 只能放在 Railway 变量中，不能放入前端文件或提交到仓库。

`.env.example` 是配置示例；程序不会自动读取 `.env`，本地需要时可运行 `node --env-file=.env server/server.mjs`。每次发布保留持久卷；备份或迁移时先停止服务，再复制完整数据库目录。没有持久卷时，重新部署可能丢失统计、点赞和匿名 Cookie 签名密钥。

仓库包含 GitHub Actions 检查：内容校验、服务端测试、Docker 构建，以及挂载持久卷后的健康检查。此仓库提供部署所需代码；创建 GitHub 仓库不代表已经创建 Railway 服务或绑定 `usyd.life` 域名。

## 统计与点赞

- **今日访客**：按悉尼当地日期，以匿名浏览器 Cookie 去重。同一浏览器当天刷新或打开多个页面仍算一位。
- **累计访问**：以匿名浏览器 Cookie 标识去重的累计访客数。同一浏览器刷新、跳转、打开多个标签页、请求重试或隔天再来，都只累计一次；新访客首次加载页面并成功连接统计接口时才增加。图片、健康检查等请求不计入。
- **运行天数**：以数据库首次初始化时的悉尼日期为起点，首日为 1 天；服务重启不会重置。
- **点赞**：首页和每条详情分别计数。每个匿名浏览器对每条内容一票，可取消；总数及个人状态保存在服务器，刷新后保留。给详情点赞不会增加首页点赞或访问数。

Cookie 是第一方随机标识，设为 HttpOnly 和 SameSite=Lax，HTTPS 环境增加 Secure。统计功能不记录 IP、姓名、页面路径或浏览器指纹。清除 Cookie 或更换浏览器会视为新访客，因此该数字是匿名浏览器统计，不等于精确的人数。页面需运行 JavaScript 并成功连接接口才会计数。

升级旧版统计库时，首次启动会按已有匿名标识自动去重历史访问，不会重置点赞、Cookie 签名密钥或运行起始日期。此前按页面加载累计的数字会相应回落。旧 `visits` 表保留作历史记录；新访问只写入累计访客和每日访客去重表，刷新不再追加页面加载记录。

前端不会用演示数字兜底；接口失败时保留已有显示并提供重试。统计逻辑在 `server/store.mjs`，接口与网页服务在 `server/server.mjs`，前端接入在 `dist/stats.js`。

## 页面结构

| 页面 | 用途 |
| --- | --- |
| `index.html` | 一屏 Bento 首页，预览各板块并进入列表 |
| `events.html` | 活动广场，关键词、时间和多标签筛选 |
| `benefits.html` | 学生权益与领取信息 |
| `notices.html` | 生活提醒 |
| `food.html` | 美食推荐 |
| `detail.html?type=event&id=gelato` | 通用详情页，每条内容都有独立链接 |
| `submit.html` | 四类内容的新增和纠错表单 |
| `guestbook.html` | GitHub 留言入口，从首页统计卡片进入 |
| `about.html` | 项目介绍 |

详情页 `type` 为 `event`、`benefit`、`notice` 或 `food`。社团是活动标签，没有独立频道。活动可以有多个标签，多选筛选取交集；筛选结果保存在网址中，便于分享。

全站导航和页脚只维护 `dist/site.js` 一处，共享视觉样式在 `dist/site.css`。首页由 `home.js` / `home.css` 负责；活动广场由 `events.js` 负责；其他三个列表共用 `catalog.js` / `catalog.css`；详情、投稿和关于页各有独立文件。所有图片位于 `dist/assets/`。

## 更新内容

所有收录内容和标签定义均位于 `dist/data.js`，维护方式见 [CONTRIBUTING.md](CONTRIBUTING.md)。新增条目会自动出现在列表、搜索、详情及纠错选项中，无需改动页面。

首页按悉尼日期展示近期活动，最多轮播 5 场。每次打开或刷新，权益、提醒、美食各随机展示一条有效内容；`expiresOn` 控制展示截止日（含当天），`active: false` 可停止推荐，没有截止日的长期内容继续参与。提醒的生效日期不等于截止日期。无有效内容时显示空状态，图片和详情链接随随机条目更新。选择逻辑位于 `dist/home-selection.js`；可选 `homeSummary` 用于卡片摘要。

修改内容后运行检查：

```sh
npm run check
```

检查必填字段、唯一 ID、日期、已知标签、来源链接、本地图片以及 HTML 引用；活动标签也会与 GitHub Issue 模板核对。浏览器中再检查对应列表、详情和手机布局。

## GitHub 投稿与自动收录

`dist/config.js` 已指向 `https://github.com/snowhejia/usyd.life`。网站表单支持活动、权益、提醒、美食的新增和纠错，校验后预填 GitHub Issue 标题及内容。访客登录 GitHub 后完成提交；内容较长时使用复制粘贴方式。`.github/ISSUE_TEMPLATE/` 同时提供直接在仓库投稿的模板。

投稿者在 GitHub 的「配图」栏目直接粘贴或拖入图片。最多 3 张，每张不超过 5 MB，支持 PNG、JPG、GIF、WebP；第一张作为封面，其余图片显示在详情页。收录时会把 GitHub 图片下载到仓库，不依赖外部图片热链。网站不会收集 GitHub 密码或把 Token 发给浏览器。

维护者只需核对 Issue，并添加 **`审核通过`** 标签：

1. **Collect approved submission** 工作流确认操作人具有仓库写入权限，校验四类内容、日期、标签、来源和配图。
2. 将审核时的投稿快照自动转换为网站数据，保存配图与 `content/submissions/<Issue 编号>.json` 收录记录。
3. 自动关联详情评论 Issue，运行内容检查和测试，然后把数据、配图、评论关联一起提交到 `main`。
4. 原 Issue 获得 **`已收录`** 标签和处理回执。连接 Railway 自动部署后，更新随部署发布。

不需要手工修改 `data.js` 或另行合并 PR。仅有 triage/read 权限的账号不能批准发布。已有内容更新保持原 ID，点赞和评论关联不变；同一版本重复执行不会重复新增或覆盖之后的更新。不同投稿同时通过时，工作流会在最新 `main` 上重试，避免覆盖其他收录。

如果校验、图片下载或测试失败，会标记 **`需补充`** 并回复原因，不提交无效内容。补充后请移除再重新添加 `审核通过` 标签。正文在审核后发生变化、条目在填写纠错表单后被其他人更新，都会要求重新审核。收录后的正文修改不会自动更新网站，需要再次审核。

网站纠错表单会预填现有信息，支持一次更新多个字段；直接使用 GitHub 纠错模板时，一次选择一个字段。显示状态设为「下架」后退出首页和列表，原详情与讨论保留。旧版自由文字纠错需要按新表单重新提交。

工作流只使用 GitHub 自动提供的 `GITHUB_TOKEN`，无需配置长期写入 Token。Actions 的 `contents: write`、`issues: write` 和 `actions: write` 分别用于数据提交、处理回执和触发后续检查。自动提交不会触发普通 `push` 工作流，因此收录任务内完成评论同步并显式触发 Checks。若日后保护 `main` 禁止此自动化写入，需要调整相应仓库规则，否则会安全失败并保留投稿。

Actions 中也可手动运行收录任务，填写 Issue 编号；默认勾选「仅校验预览」，不会写入仓库。关闭该选项时仍需 `审核通过` 标签和维护者权限。内容维护字段见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 详情评论

活动、权益、提醒和美食共用详情评论区。每条内容有一条独立 GitHub Issue，稳定对应 `类型:id`；读者可以在网站阅读评论，点击「写评论」到 GitHub 回复、编辑或上传图片。

- 已有内容的讨论映射保存在 `dist/discussions.js`。
- 通过 Issue 自动收录时，评论关联与内容一起提交；手工更新数据时，**Sync content discussions** 工作流补齐讨论映射。也可在 Actions 手动运行。
- 讨论通过 `content-discussion` 标签和正文中的稳定标识匹配。修改标题时保留内容 ID 和该标识，避免拆散历史评论。删除网站条目不会删除 GitHub 讨论。
- 网站的 `/api/content/:type/:id/comments` 只读取评论，缓存约 3 分钟；「刷新评论」最多每 30 秒向 GitHub 更新一次。返回网站时也会刷新。
- GitHub 限流或暂时不可用时保留上次可读结果，并提供原讨论入口；新部署且没有缓存时显示加载失败，不生成假评论。
- 评论富文本通过标签与链接白名单渲染。评论区不接受内联脚本、事件属性、表单或 iframe。

评论记录保存在 GitHub，独立于 Railway 数据库。匿名点赞保存在 SQLite，不会自动变成 GitHub reaction。

维护者如需手动同步：

```sh
GITHUB_REPOSITORY=snowhejia/usyd.life GITHUB_TOKEN=... npm run sync:discussions
```

此同步 Token 只在维护者终端或 GitHub Actions 中使用，需要仓库 Issues 写入权限。不要把它用作网站的 `GITHUB_READ_TOKEN` 或提交到代码。

## 留言板

首页统计卡片的「留言板」打开 `guestbook.html`。「去 GitHub 留言」使用 `new-guestbook.yml` 模板创建 Issue；「查看留言」展示标题含 `[留言]` 的讨论，也包括已关闭的记录。请保留此前缀，回复直接使用 Issue 评论。

留言内容、作者、图片、回复和时间记录均保存在 GitHub。相关页面代码为 `dist/guestbook.*`。网站不提供 `/api/guestbook` 写入接口；旧版数据库中的 `guestbook_messages` 表仍保留供备份，不会自动上传。统计与点赞继续使用 SQLite。

## 资料与许可

现有资料快照日期为 2026-10-03。每条内容保留来源；来源与图片归属见 [CREDITS.md](CREDITS.md)。网站不自动同步 Craft 或主办方页面。活动日期、费用和有效性需要持续维护。

代码采用 [MIT 许可](LICENSE)。该许可不覆盖第三方照片、海报、通知截图、商标及其内容。
