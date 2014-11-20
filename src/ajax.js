;
(function($) {
    $.ajax = function(settings) {
        // 配置合并
        settings = $.extend({
            type: 'get',
            dataType: 'text',
            url: location.href,
            async: true,
            data: {},
            context: window,
            timeout: 0
        }, settings);

        // Get请求处理
        if (settings.type. === 'get') {
            // 参数处理
            if (typeof settings.data == 'object') {
                var query = url.indexOf('?');
                var paramStack = [];
                Object.keys(settings.data).forEach(function(i) {
                    paramStack.push(i + '=' + settings.data[i]);
                });
                url += (query == -1 ? '?' : '&') + paramStack.join('&');
            }
            // JSONP处理
            if (settings.dataType == 'jsonp') {
                return $.getScript(settings.url, settings.success, settings.error);
            }
        }

        // AJAX处理
        var promise = new Promise(function(resolve, reject) {
            var abortTimeout;
            var xhr = new XMLHttpRequest();
            xhr.onreadystatechange = function() {
                //请求完成
                if (xhr.readyState == 4) {
                    xhr.onreadystatechange = undefined;
                    clearTimeout(abortTimeout);
                    if ((xhr.status >= 200 && xhr.status < 300) || xhr.status == 304 || xhr.status == 0) {
                        var error = false;
                        var result = xhr.responseText;
                        try {
                            switch (settings.dataType) {
                                case 'script':
                                    (1, eval)(result);
                                    break;
                                case 'xml':
                                    result = xhr.responseXML
                                    break;
                                case 'json':
                                    result = JSON.parse(result);
                            }
                        } catch (e) {
                            error = e
                        }

                        if (error) {
                            reject({
                                error: 'parser',
                                status: xhr.status
                            });
                        } else {
                            resolve(result)
                        }
                    } else {
                        reject({
                            error: 'http',
                            status: xhr.status
                        });
                    }
                }
            };
            if (settings.timeout > 0) {
                abortTimeout = setTimeout(function() {
                    xhr.onreadystatechange = empty;
                    xhr.abort();
                    reject({
                        error: 'timeout',
                        status: 504
                    });
                }, settings.timeout);
            }
            xhr.open(settings.type, settings.url, settings.async);
            xhr.send(settings.data ? settings.data : null);
        });

        if (typeof done === 'function') {
            promise.then(done);
        }
        if (typeof fail === 'function') {
            promise.then(undefined, fail);
        }
        return promise;
    };

    var index = 0;
    $.getScript = function(url, done, fail) {
        // 替换回调函数
        var query = url.indexOf('?');
        var callbackName = 'jsonp' + index++;
        var replaceIndex = url.indexOf('?', query + 1);
        if (replaceIndex != -1) {
            url = url.substring(0, replaceIndex) + callbackName + url.substring(replaceIndex + 1);
        }
        // 创建异步操作
        var promise = new Promise(function(resolve, reject) {
            window[callbackName] = resolve;
            var head = document.head;
            var script = document.createElement('script');
            script.onload = script.onerror = function(e) {
                if (e.type == 'load') {
                    if (replaceIndex == -1) {
                        resolve(e);
                    }
                } else {
                    reject(e);
                }
                script.onload = script.onerror = null;
                delete window[callbackName];
                head.removeChild(script);
            }
            script.type = 'text/javascript';
            script.src = url;
            head.appendChild(script);
        });

        if (typeof done === 'function') {
            promise.then(done);
        }
        if (typeof fail === 'function') {
            promise.then(undefined, fail);
        }
        return promise;
    };

    $.getJSON = function(url, params, done, fail) {
        if ($.type(params) === 'function' && fail === undefined) {
            fail = done;
            done = params;
            params = undefined;
        }

        return $.ajax({

        });
    };
}(Mirror));