var conf = {
    name: "mirror",
    build: "bin"
};
// 清理构建目录
var gulp = require("gulp");
var del = require("del");
gulp.task("clear", function(cb) {
    del([conf.build, "**"].join("/"), {
        force: true
    }, cb);
});
// 开始构建文件
var concat = require("gulp-concat");
var uglify = require("gulp-uglify");
var include = require("gulp-file-include");
// var obfuscate = require("gulp-obfuscate");
gulp.task("build", ["clear"], function() {
    var files = [
        "src/shim.js",
        "src/mirror.js",
        "src/event.js",
        "src/ajax.js",
        "src/css.js",
        "!**/_*.*"
    ];
    gulp.src(files)
        .pipe(include())
        .pipe(concat(conf.name + ".js"))
        //.pipe(uglify())
        .pipe(gulp.dest([conf.build].join("/")));
});
gulp.task("default", ["build"]);