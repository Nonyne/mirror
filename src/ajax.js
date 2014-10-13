;(function($) {
    var index = 0;
    $.getJSON = function(url, params, done, fail) {
        if ($.type(params) === 'function' && fail === undefined) {
            fail = done;
            done = params;
            params = undefined;
        }

        if ($.type(params) == 'object') {
            var paramStack = [];
            Object.keys(params).forEach(function(i) {
                paramStack.push(i + '=' + params[i]);
            });
            url += (url.indexOf('?') == -1 ? '?' : '&') + paramStack.join('&');
        }

        var promise = new Promise(function(resolve, reject) {
            var callbackName = 'jsonp' + index++;
            var replaceIndex = url.indexOf('?', url.indexOf('?') + 1);
            if (replaceIndex != -1) {
                url = url.substring(0, replaceIndex) + callbackName + url.substring(replaceIndex + 1);
                window[callbackName] = resolve;
            }
            var head = document.head;
            var script = document.createElement('script');
            script.onload = script.onerror = function(e) {
                e.type == 'error' && reject(e);
                script.onload = script.onerror = null;
                delete window[callbackName];
                head.removeChild(script);
            }
            script.type = 'text/javascript';
            script.src = url;
            head.appendChild(script);
        });
        return promise;
    }
}(Mirror));