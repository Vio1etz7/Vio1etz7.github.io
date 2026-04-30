---
title: Astro + Fuwari + Giscus 评论区的集成
published: 2026-04-30
description: "集成Giscus评论系统"
image: "130909657_p0_master1200.jpg"
tags: [astro,blog,Fuwari,Giscus]
category: 博客历险记
draft: false
---

接上一篇博客末尾，今天来进行Giscus评论区的集成

## 背景介绍
Giscus 是一个开源的评论系统，它基于 GitHub Discussions，不需要数据库，可以与 GitHub 集成，实现 GitHub 账号登录，并同步到 GitHub 账号。

因为在Fuwari项目中没有集成comment功能，因此需要手动修改代码加入这个功能。需要先在`types/config.ts`中添加一个名为`CommentConfig`的接口,再在`config.ts`调用并赋值。具体操作参看下面的步骤。

## 集成步骤
### 1.准备 Github 仓库
（1）确保你的博客仓库已经创建且为公开-public
（2）进入仓库的settings -> General ，找到 Features 部分，勾选 Discussions[^1]。

### 2.获取 Giscus 的配置信息
1.访问 [giscus.app](https://giscus.app/)
2. 填写仓库名称，并根据需求勾选其他信息。
3. 这之后就会在**启用Giscus**选项卡中看到配置信息。保存好这段代码，后面会用到

### 3.在Fuwari中配置
1.

2.打开 `src/types/config.ts`,在文件末尾添加如下代码：
```
export type CommentConfig = {
    enable: boolean;
    repo: string;
    repoId: string;
    category: string;
    categoryId: string;
    mapping?: string;
    strict?: string;
    reactionsEnabled?: string;
    emitMetadata?: string;
    inputPosition?: string;
    theme?: string;
    lang?: string;
    loading?: string;
};

```

3.在 `src/config.ts` 中添加如下代码：
```
export const commentConfig: CommentConfig = {
    enable: true,
    repo: "你的仓库地址",
    repoId: "giscus生成的data-repo-id", 
    category: "你选择的category，一般是Announcements",
    categoryId: "giscus生成的data-category-id", 
    mapping: "pathname",
    strict: "0",
    reactionsEnabled: "1",
    emitMetadata: "0",
    inputPosition: "top",
    theme: "preferred_color_scheme",
    lang: "zh-CN",
    loading: "lazy",
};
```
4.修改文章页面模版，我们需要把评论区挂载到每一篇文章的末尾。打开`src/pages/posts/[...slug].astro`
在上方的---区域内导入刚刚写的配置
`import { commentConfig } from "@/config";`
在下方的 HTML 结构中，找到文章内容结束的地方（通常在 </Markdown> 标签之后），插入 Giscus 的代码
```
{commentConfig.enable && (
    <div class="mt-4 card-base p-6">
        <script src="https://giscus.app/client.js"
                data-repo={commentConfig.repo}
                data-repo-id={commentConfig.repoId}
                data-category={commentConfig.category}
                data-category-id={commentConfig.categoryId}
                data-mapping={commentConfig.mapping}
                data-strict={commentConfig.strict}
                data-reactions-enabled={commentConfig.reactionsEnabled}
                data-emit-metadata={commentConfig.emitMetadata}
                data-input-position={commentConfig.inputPosition}
                data-theme={commentConfig.theme}
                data-lang={commentConfig.lang}
                data-loading={commentConfig.loading}
                crossorigin="anonymous"
                async>
        </script>
    </div>
)}
```
## end

[^1]: Discussions 是 GitHub 的一个功能，用于创建一个讨论区，用于用户进行交流,Giscus 就是基于这个功能开发的