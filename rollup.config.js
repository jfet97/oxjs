import typescript from "rollup-plugin-typescript2";
import cleanup from "rollup-plugin-cleanup";
import minify from "rollup-plugin-babel-minify";
import pkg from "./package.json";

export default {
  input: "src/index.ts",
  output: [
    {
      file: pkg.main,
      format: "esm",
      sourcemap: true,
    }
  ],
  external: [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {})
  ],
  plugins: [
    typescript({
      typescript: require("typescript")
    }),
    cleanup({
      comments: "none",
      extensions: ["ts"]
    }),
    minify({}),
  ]
};
