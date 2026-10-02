# 图片与资料来源

## 校园照片

- 文件：`dist/assets/campus-hero.jpg`
- 作者：Toby Hudson
- 原始照片：[SydneyUniversity MainQuadrangle panorama](https://commons.wikimedia.org/wiki/File:SydneyUniversity_MainQuadrangle_panorama.jpg)
- 许可：[CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/)
- 处理：缩小至 2560 像素宽；网页通过 CSS 裁切、调整饱和度与亮度并覆盖渐变。照片与其适配版本保留 CC BY-SA 3.0 许可。
- 拍摄于 2009 年，仅作为校园氛围照片，不代表当前景观或活动现场。

## 用户提供的资料

- `gelato-source.jpg`、`community-source.jpg`、`canva-source.jpg`：用户 [Craft 收藏](https://books-cough-6mk.craft.me/0j05SQY1ZMu8ai) 中的学校通知截图。
- `gelato-update.jpg`：用户在本次对话补充的最新通知，确认 10 月 6 日上午 11 点、送完为止。
- `community-card.jpg`：早期从用户提供的 Community Festival 通知截图裁切出的活动照片，现已由官方高清原图替换，保留作原素材记录。

上述截图与照片的版权属于原权利人，没有被网站代码的 MIT 许可重新授权。

## Community Festival 官方照片

- 来源：[Community Festival 2026 官方首页](https://community-festival.sydney.edu.au/2026/10819038?ref=edm-a-o-n3-wods)，于 2026-10-03 核对。
- `dist/assets/community-festival-performer.jpg`：1920 × 1280 像素，[官方原图](https://assets.swoogo.com/uploads/full/6950929-69f2c95d0e74a.jpg)。用于首页轮播、活动卡片及详情；为官网活动宣传照片，不代表尚未举办的 2026 年现场。
- `dist/assets/community-festival-campus.jpg`：1918 × 1280 像素，[官网首页背景原图](https://assets.swoogo.com/uploads/full/6934452-69f030d36e92f.jpg)，校园与家庭场景，保留为备用素材。
- 原始 JPEG 文件未做 AI 重绘或放大，页面通过 CSS 自适应裁切。版权属于悉尼大学／原作者，未确认开放许可；项目代码的 MIT 许可不覆盖这些照片。

## 活动海报

- `manning-banner.png`：来自 [USU Manning Night Market 官方页面](https://usu.edu.au/manning-night-market/)。
- [原图](https://images.ctfassets.net/n92mdxt3dwn7/r9DsFMQki2oGQMzfA9ECx/2b0fa0e6595d19056b74eb1d95bd63a4/WebsiteBanner.png?w=2000&h=600&fit=fill)
- 版权属于 USU／原作者，未确认有开放许可。用于本地 demo 对相应活动的介绍，代码许可不覆盖该素材。

Free Gelato 卡片采用原创文字排版；首页轮播配有项目内绘制的简单 SVG 像素冰淇淋插图，没有把其他商家的冰淇淋照片当作该活动照片。首页学生权益、生活提醒、美食推荐使用下列真实配图，独立显示在标题上方，不叠加透明度或渐变。

## 蜡笔小狮子

- 文件：`dist/assets/after-class-lion.png`。
- 按用户提供的蜡笔小狮子参考图，用 imagegen 生成的透明背景吉祥物。采用蓬松的橙色鬃毛、黄色脸部与小身体、炭灰色五官，保留大小不一的轮廓、蜡笔颗粒和没涂满的空隙。
- 参考图由用户在本次对话提供；此吉祥物用于学生项目的本地 demo，不是学校官方校徽。

## 早期像素小狮子

- 文件：`dist/assets/after-class-lion-pixel.png`，保留为历史版本。
- 使用内置 imagegen，以既有蜡笔狮子为编辑对象、当前首页为风格参考，保留橙色鬃毛和黄色脸部，加入像素轮廓与深棕描边。透明背景，原素材继续保留。
- 完整生成提示词与工具记录见 `design/logo-prompt.txt`。

## 美食资料

- [Courtyard 官方页面](https://usu.edu.au/food-drink/courtyard/) 与其 [2026 食品菜单](https://assets.ctfassets.net/n92mdxt3dwn7/4P2U3aDDkne9LBjkBjo38k/c068d7737e881b48632eb95ac652da86/CY-A4_Food_Menu2026.pdf)：店铺位置、餐食与披萨非会员价 A$15–25。
- [NeNe Chicken 官方页面](https://usu.edu.au/food-drink/nene-chicken/) 与 [Happy Ramen Canteen 官方页面](https://usu.edu.au/food-drink/happy-ramen-canteen/)：位置、餐食及营业时间，尚无核实的菜品价格。
- 资料核对日期为 2026-10-03。首批资料不是用户亲测评论，页面保留来源、价格条件和核对日期。
- 首批餐厅已使用 USU 官方实拍。项目内的披萨、炸鸡和餐碗 SVG 仅供未来没有配图的条目作为回退图标。

## 页面配色与风格

- 参考 [Sydney Informatics Hub 的 usydColours 色表](https://github.com/Sydney-Informatics-Hub/usydColours#rgb-values-and-hex-codes-of-colours) 中的 MasterbrandOchre `#E64626`、MasterbrandCharcoal `#424242` 和 Sandstone `#FBEEE2`。
- 网站使用自己的浅色背景搭配，主按钮的赭橙加深为 `#CF3C20`，以保证白色小字的可读性。

- 最新桌面风格根据用户提供的复古像素界面参考重新排版；浅蓝网格、奶油色面板和青绿色标题栏由 CSS 实现，像素图标为项目内的简单 SVG 图形。参考图片本身未作为网页素材嵌入。当前统一视觉样式位于 site.css，页面布局分别维护。

## 当前简化狮子头像

- 文件：`dist/assets/usyd-events-lion-simple.png`，用于全站导航、关于页和浏览器图标。
- 使用内置 imagegen，将早期像素狮子简化为头像：移除身体、尾巴、细碎鬃毛笔画与高光，保留橙黄配色、大块轮廓、深棕五官和透明背景。
- 生成提示词和工具记录见 `design/logo-simple-prompt.txt`。英文标识统一为 USYD EVENTS WALL。


## 学生权益、生活提醒与美食配图

以下图片于 2026-10-03 从来源页面取得并保存在 `dist/assets/`，由首页、栏目列表和内容详情共享。仅通过 CSS 裁切显示，不做 AI 重绘。

| 文件 | 作者／来源 | 用途与许可 |
| --- | --- | --- |
| `canva-campus-official.png` | [Canva for Campus 官方发布页](https://www.canva.com/newsroom/news/canva-for-campus/) · [原图](https://content-management-files.canva.com/a3fada50-12b2-4a4d-ad1b-6bd4c1317a7f/MYNEWSROOMArticleBanners61.png?resize-width=1600) | Canva 官方产品宣传图；不是悉尼大学专属界面截图。版权属于 Canva／原权利人，未确认开放许可。 |
| `courtyard-photo.jpg` | [USU Courtyard](https://usu.edu.au/food-drink/courtyard/) · [原图](https://images.ctfassets.net/n92mdxt3dwn7/21fgnQJAucVUyWSztcsqr1/4050a02d738757aeadcf0dbdbc47c0a0/courtyard-1.jpg) | 对应餐厅的餐食实拍。版权属于 USU／原作者，未确认开放许可。 |
| `nene-chicken-photo.jpg` | [USU NeNe Chicken](https://usu.edu.au/food-drink/nene-chicken/) · [原图](https://images.ctfassets.net/n92mdxt3dwn7/7Lc5hLIav2PNyk8hlnxCX7/597bf8abba10ae7fb0e979d69a20ea08/1-nenechicken.jpg) | 对应店铺的用餐场景实拍。版权属于 USU／原作者，未确认开放许可。 |
| `happy-ramen-photo.jpg` | [USU Happy Ramen Canteen](https://usu.edu.au/food-drink/happy-ramen-canteen/) · [原图](https://images.ctfassets.net/n92mdxt3dwn7/5Yb773Elj6nCSDrP7goHSX/3affc3ce15056b6f90411ffa6c9e9a3b/happy-ramen-canteen-1.jpg) | 对应店铺的拉面实拍。版权属于 USU／原作者，未确认开放许可。 |
| `daylight-saving-clock.jpg` | [Towfiqu barbhuiya / Unsplash](https://unsplash.com/photos/white-and-pink-analog-alarm-clock-jOeh3Lv88xA) | 时间调整主题的实体闹钟配图，不用于证明活动日期或钟表设置；[Unsplash License](https://unsplash.com/license)。 |
| `card-payment.jpg` | [SumUp / Unsplash](https://unsplash.com/photos/payment-is-being-made-with-a-credit-card-AAYpF9Vx7Ek) | 银行卡支付主题配图，不是政策发布机构的照片；[Unsplash License](https://unsplash.com/license)。 |

项目代码的 MIT 许可不重新授权上述第三方图片。图片来源保存在条目的 `imageSource` 与 `imageCredit` 字段中，内容本身的核对来源仍使用 `source`。


## 新增学生权益与桌游活动

- FoodHub 的预约方式、领取上限、位置与开放时段来自 [USU FoodHub](https://usu.edu.au/foodhub/)，核对于 2026-10-03；预约入口为 [USU FoodHub 门户](https://secure.usuonline.com/fh)。不同 USU 页面存在时段差异，本项目采用 FoodHub 专页的 09:00–16:00，并提示按预约票入场。
- `dist/assets/foodhub-official.jpg` 为 [USU 原图](https://images.ctfassets.net/n92mdxt3dwn7/2jOjCSFsMuXzH1pF0mtM2d/5003a3a677b1c492a78bd471a052e3f3/foodhub-1.jpg)，版权属于 USU／原作者，未确认开放许可。
- University Canteen 的位置、价格、学生证要求与供餐时段来自 [学校现行说明](https://www.sydney.edu.au/students/food-and-retail-on-campus/campus-cheap-eats.html)，核对于 2026-10-03；现行页面与校园地图标为 J03 Level 2，未沿用早期施工公告中的 Level 1。
- `dist/assets/university-canteen-menu.jpg` 来自学校链接的 [官方菜单](https://storage.googleapis.com/smartqprdau_pub/hf/unisyd/027d91f78ec5de9fa1653f5ca1710840/index.html) 中的 [菜单图片](https://assets.unlayer.com/projects/0/1790926948285-Slide1.JPG)。用于菜单示例配图，非餐食实拍或固定菜单承诺；当前菜品通过详情的「查看最新菜单」查询。版权属于原权利人，未确认开放许可。
- Boardgames & Origami 的日期、时间、地点、参加对象和免费零食来自用户提供的 Computer Science Student Portal 通知截图。仅录入活动信息，不把截图中的收件地址、Reply-To 地址或邮件元数据存入网站。原通知未提供直接可公开的活动链接，详情入口链接到 Canvas 登录页，并标明学生门户。
- `dist/assets/boardgames-dice.jpg` 为 [Joel Abraham / Unsplash](https://unsplash.com/photos/white-and-black-dice-on-red-textile-8RRYJg26Wr4) 的骰子主题照片，适用 [Unsplash License](https://unsplash.com/license)，并非此次活动的现场照片。

## 邦迪海滩雕塑节

- 2026 年展期为 10 月 16 日至 11 月 2 日，地点为 Bondi 至 Tamarama 海岸步道，免费参观。资料于 2026-10-03 核对自 [主办方官网](https://sculpturebythesea.com/bondi/) 与 [官方参观指南](https://visit.sculpturebythesea.com/)。公共交通建议来自 [Transport for NSW 活动页](https://transportnsw.info/events/2026/10/sculpture-by-sea)。
- `dist/assets/bondi-sculpture-by-the-sea.jpg`：1000 × 673 像素，[官网原图](https://sculpturebythesea.com/wp-content/uploads/2025/10/AndrewCullenQLD_Rustle_SxSBondi2025_CharlotteCurd-3-1.jpg)。作品为 Andrew Cullen 的《Rustle》，摄影 Charlotte Curd，拍摄于 Sculpture by the Sea, Bondi 2025；不是尚未举办的 2026 年现场。
- 原始 JPEG 未作 AI 修改，页面通过 CSS 裁切。版权属于摄影师／原权利人，未确认开放许可；项目代码的 MIT 许可不覆盖此照片。

## KURA ICHI 日料

- 地址与菜品于 2026-10-03 核对自 [Kura Ichi (Haymarket) 店铺菜单](https://www.ubereats.com/au/store/kura-ichi-haymarket/dRUqeA6WQjuFgKPunqqf9g)；地址为 Shop 3, 76 Ultimo Road, Haymarket NSW 2000。菜单入口为 Uber Eats 外送菜单，未将外送价格和配送时段作为堂食价格或营业时间。
- `dist/assets/kura-ichi-sashimi-bowl.jpg`：550 × 440 像素，来自上述店铺的 Deluxe Sashimi Bowl 菜品实拍。[原图](https://tb-static.uber.com/prod/image-proc/processed_images/3dac52f7d678bce2dba740e991fbbcb2/a1681d67ebe55c76c3af5f401619c278.jpeg)。仅通过 CSS 裁切显示，未放大或 AI 重绘。
- 图片版权属于店铺／原权利人，未确认开放许可，项目代码的 MIT 许可不覆盖此照片。
