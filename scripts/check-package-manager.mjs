// preinstall 守卫：只允许用 pnpm 安装依赖。
// 取代原来的 `npx only-allow pnpm`——那条命令每次安装都要联网从 npm 下载
// only-allow 包，CI 里一旦 registry 抖动就会让整个 install 失败。
const userAgent = process.env.npm_config_user_agent ?? "";
const name = userAgent.split(" ")[0] ?? "";

if (!name.startsWith("pnpm/")) {
	console.error(
		`\n[preinstall] 请使用 pnpm 安装依赖（当前检测到：${name || "未知包管理器"}）。\n` +
			`先执行：npm i -g pnpm\n`,
	);
	process.exit(1);
}
