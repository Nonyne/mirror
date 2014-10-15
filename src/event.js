;(function($) {
    // event proxy
    var createProxy = function(e) {
            var proxy = {
                originalEvent: event
            };
            Object.keys(e).forEach(function(i) {
                proxy[i] = e[i];
            });
            return proxy;
        }
        // extend method
    $.extend($.fn, {
        on: function(event, selector, callback) {
            var me = this;
            var eventType = $.type(event);

            if (eventType !== 'undefined') {
                // selector
                switch ($.type(selector)) {
                    case 'string':
                        if ($.type(callback) === 'function') {
                            callback = function(selector, e) {
                                var target = $(e.target).closest(selector).get(0);
                                if (target) {
                                    var evt = createProxy(e);
                                    return this.call(target, evt);
                                }
                            }.bind(callback, selector);
                        }
                        break;
                    case 'function':
                        if ($.type(callback) !== 'function') {
                            callback = selector, selector = undefined;
                        }
                }
                // event binding
                if (eventType == 'string' && callback) {
                    event = event.split(/\s+/g);
                    this.each(function(index) {
                        var node = this;
                        event.forEach(function(i) {
                            node.addEventListener(i, callback, false);
                        });
                    });
                }
            }
            return me;
        }
    });
}(Mirror));