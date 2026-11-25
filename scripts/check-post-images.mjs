/**
 * 检查文章引用的图片是否真的会出现在线上构建里。
 *
 * 动机：这个博客是「本地 dev 直接从磁盘读文件，线上是 GitHub Actions 用仓库内容构建」。
 * 所以只要图片文件没被 git 跟踪（忘 add、被 .gitignore 掉、复制时漏了），就会出现
 * 「本地好好的，push 上去图片没了」——而且不会报错，构建照样通过。
 *
 * 这个脚本把这种情况变成构建期的硬失败：图片不存在、或存在但没被 git 跟踪，都直接退出 1。
 *
 * 检查范围：
 *   - frontmatter 的 image: 字段（列表卡片 / 文章顶部封面）
 *   - 正文里的 ![alt](相对路径) 行内图片
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const POSTS_DIR = path.join("src", "content", "posts");

/** 递归找出所有 markdown 文件 */
function walk(dir) {
	const out = [];
	for (const name of readdirSync(dir)) {
		const full = path.join(dir, name);
		if (statSync(full).isDirectory()) {
			out.push(...walk(full));
		} else if (/\.mdx?$/i.test(name)) {
			out.push(full);
		}
	}
	return out;
}

/** 取 frontmatter 原文（不含 --- 包裹行） */
function frontmatterOf(text) {
	const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	return m ? m[1] : "";
}

/** frontmatter 里的 image: "xxx" */
function coverFrom(frontmatter) {
	const m = frontmatter.match(/^image:\s*(.+)$/m);
	if (!m) return null;
	return m[1].trim().replace(/^["']|["']$/g, "");
}

/** 正文里的相对路径行内图片 */
function inlineImages(body) {
	const refs = [];
	const re = /!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
	let m;
	while ((m = re.exec(body)) !== null) {
		const src = m[1];
		// 跳过绝对 URL、协议相对、站内绝对路径、data URI
		if (/^(?:[a-z]+:)?\/\//i.test(src)) continue;
		if (/^(?:data:|mailto:|#)/i.test(src)) continue;
		if (src.startsWith("/")) continue;
		refs.push(src);
	}
	return refs;
}

/** 是否被 git 跟踪（未跟踪 = 不会进 CI 构建） */
function isTracked(repoRelPath) {
	try {
		execFileSync("git", ["ls-files", "--error-unmatch", "--", repoRelPath], {
			stdio: "ignore",
		});
		return true;
	} catch {
		return false;
	}
}

const problems = [];
const posts = existsSync(POSTS_DIR) ? walk(POSTS_DIR) : [];

for (const file of posts) {
	const text = readFileSync(file, "utf8");
	const fm = frontmatterOf(text);
	const dir = path.dirname(file);

	const candidates = [];
	const cover = coverFrom(fm);
	if (cover) candidates.push({ kind: "封面 image:", src: cover });
	for (const src of inlineImages(text)) candidates.push({ kind: "行内图片", src });

	for (const { kind, src } of candidates) {
		const decoded = decodeURIComponent(src.split("?")[0].split("#")[0]);
		const abs = path.resolve(dir, decoded);
		const repoRel = path.relative(process.cwd(), abs).split(path.sep).join("/");

		if (!existsSync(abs)) {
			problems.push(`${file}\n    ${kind} 指向的文件不存在: ${src}  (解析为 ${repoRel})`);
			continue;
		}
		if (!isTracked(repoRel)) {
			problems.push(
				`${file}\n    ${kind} 的文件没有被 git 跟踪: ${src}\n    线上构建拿不到它，先执行: git add "${repoRel}"`,
			);
		}
	}
}

if (problems.length > 0) {
	console.error("\n✖ 文章图片检查失败：以下图片不会出现在线上构建里\n");
	for (const p of problems) console.error("  - " + p + "\n");
	console.error(
		`共 ${problems.length} 处问题。图片必须存在于文章同目录且被 git 跟踪。\n`,
	);
	process.exit(1);
}

console.log(`✓ 文章图片检查通过（${posts.length} 篇）`);
