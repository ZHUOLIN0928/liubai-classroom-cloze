# 留白 · 课堂挖空工作台

这是从 Lnk Lumen 主产品拆出的纯前端原型，给老师在课堂默写、投影与课件中制作“挖空”材料。

- 官网：`https://zhuolin0928.github.io/liubai-classroom-cloze/`
- 在线工作台：`https://zhuolin0928.github.io/liubai-classroom-cloze/workbench/`
- 免安装离线版：见 `v0.1.0` GitHub Release。

公开源码只包含可编辑示例内容。完整课堂内容库由独立的非公开发布流程注入线上站点和离线包，不进入公开源码仓库或公开 Git 历史；已发布的站点和离线包为教学使用提供内容，但内容本身不以开源许可证授权再分发。

它不读取主产品的 SQLite 学习记录、不联网、不含账号，也不会改写 Lnk Lumen 的内容库。默认的三篇课文仅是基于现有内容库的可编辑示例；浏览器会把老师自己的内容库保存在当前浏览器的 LocalStorage 中。

第一次打开时，已发布版本会直接载入构建时注入的课堂库；一旦教师编辑或手动导入 JSON，浏览器中的本地库优先，绝不会被后续静态库覆盖。离线 ZIP 解压后直接打开 `public-site/index.html`，不需要网络、安装或代码签名。

## 运行

无需安装依赖。以任意静态服务器打开这个目录，例如：

```bash
python3 -m http.server 4173
```

然后访问 `http://127.0.0.1:4173`。

在私有内容发布工作区中，主项目内容库有新的人工审核内容时，可运行以下命令重新生成内容包；该过程只读 `../../backend/data/lnk-lumen.sqlite3`：

```bash
npm run export:lnk-library
npm run verify:library
```

随后由发布流程使用私有内容包生成站点和离线 ZIP：

```bash
npm run build:public-release -- \
  --content /private/content-library.json \
  --out /release/site \
  --offline-zip /release/liubai-classroom-cloze-offline.zip
```

## 课堂操作

- 从左侧选择课文，或通过“编辑内容库”直接改文字与词类标注。
- 用“随机、句首、句尾、挖实词、挖虚词”快速生成；规则会叠加。
- 原文区支持鼠标或触屏：点按一个字切换留白；按住并掠过多个字连续挖空/恢复。可撤销。
- 右侧选择 16:9、4:3、A4 横/纵、或 `3:2` 这类自定义比例；选择纸白、墨灰、暖砂主题与下划线、方框、留白样式。
- 导出 PNG（主通路，2× Canvas）、Markdown，或可由 Word 打开的 `.doc` 文档。

## 内容库 JSON 格式

可从页面左下“导出本地内容库”获得完整模板，再导入回来。每一篇至少需要 `title` 与 `text`：

```json
[
  {
    "id": "my-text-1",
    "title": "示例篇目",
    "author": "作者",
    "dynasty": "朝代",
    "stage": "高中",
    "text": "第一段原文。\n\n第二段原文。",
    "anchors": [
      { "term": "而", "type": "function" },
      { "term": "学", "type": "content" }
    ]
  }
]
```

`type` 的 `content` 表示文言实词，`function` 表示文言虚词。一个标注词会匹配原文中全部相同位置；在编辑器中仍可手动调整任何单字。
