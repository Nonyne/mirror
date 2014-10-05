var Mirror = function() {
	var emptyArray = [];
	var slice = emptyArray.slice;
	var every = emptyArray.every;
	var filter = emptyArray.filter;
	var methodAttributes = ['val', 'css', 'html', 'text', 'data', 'width', 'height', 'offset'];
	function compact(array){
		return filter.call(array, function(item){
			return item != null;
		});
	}
	
	function fnArgument(context, fn, idx, payload){
		return $.type(fn) === 'function' ? fn.call(context, idx, payload) : fn;
	}
	
    var mirror = {};
    var $ = function(selector, context) {
        return mirror.init(selector, context);
    };

	// 方法集	
	$.fn = {
		ready: function(){},
		each: function(callback){
      		every.call(this, function(el, idx){
        		return callback.call(el, idx, el) !== false;
      		});
      		return this;
    	},
		empty: function(){
			return this.each(function(){
				this.innerHTML = '';
			});
		},
		append: function(){
			
		},
		html: function(html){
			return 0 in arguments ? this.each(function(idx){
				var originHtml = this.innerHTML;
				this.innerHTML = fnArgument(this, html, idx, originHtml);
			}) : (0 in this ? this[0].innerHTML: null);
		}
	};
	
    // 对象原型
    var proto = function(nodes, selector) {
        nodes = nodes || [];
        nodes.__proto__ = $.fn;
        nodes.selector = selector || '';
        return nodes;
    };
	proto.prototype = $.fn;
	
    // 原型判断
    $.is = function(object) {
        return object instanceof proto;
    };
	
	// 类型判断
	$.type = function(target) {
        var result = typeof target;
        switch (result) {
            case 'object':
                if (target === null) {
                    result = 'null';
                } else if (Node && target instanceof Node) {
                    result = target.nodeType == target.DOCUMENT_NODE ? 'document' : 'node';
                } else {
                    result = toString.call(target).replace(/^\[object (\w+)\]$/, '$1').toLowerCase();
                }
                break;
        }
        return result;
    };
	
	$.each = function(target, callback){
		if(target.every){
			target.every(function(i, idx){
				return callback.call(i, idx, i) === false;
			});
		} else {
			var keys = Object.keys(target);
			keys.every(function(i, idx){
				return callback.call(target[i], i, target[i]) === false;
			});
		}
		return target;
	};
	
    mirror.init = function(selector, context) {
        var nodes;
        // 无参数对象
        if (!selector) {
            return proto();
        }
        // 已转换对象
        if ($.is(selector)) {
            return selector;
        }
		
        switch ($.type(selector)) {
            case 'function':
                return $(document).ready(selector);
            case 'array':
                nodes = compact(selector), selector = null;
                break;
			case 'object':
			case 'node':
                nodes = [selector], selector = null;
                break;
			case 'nodelist':
				nodes = slice.call(selector), selector = null;
				break;
            case 'string':
                selector = selector.trim();
                if (selector[0] == '<') {
                    nodes = fragment(selector, context), selector = null;
                } else if (context !== undefined) {
                    return $(context).find(selector);
                } else {
                    nodes = slice.call(document.querySelectorAll(selector));
                }
                break;
        }
        return proto(nodes, selector);
    };

    // HTML片段构造
    var fragmentRE = /^\s*<(\w+|!)[^>]*>/;
    var singleTagRE = /^<(\w+)\s*\/?>(?:<\/\1>|)$/;
    var table = document.createElement('table');
    var tableRow = document.createElement('tr');
    var containers = {
        'tr': document.createElement('tbody'),
        'tbody': table,
        'thead': table,
        'tfoot': table,
        'td': tableRow,
        'th': tableRow,
        '*': document.createElement('div')
    };
    var fragment = function(html, properties) {
        var nodes, container;
        // 唯标记
        if (singleTagRE.test(html)) {
            nodes = $(document.createElement(RegExp.$1));
        }
        // 复合结构
        if (!nodes) {
            var name = fragmentRE.test(html) && RegExp.$1;
            container = containers[name in containers ? name : '*'];
            container.innerHTML = '' + html;
            nodes = $(slice.call(container.childNodes)).each(function(){
                container.removeChild(this);
            });
        }

        if ($.type(properties) == 'object') {
            $.each(properties, function(key, value){
				if (methodAttributes.indexOf(key) > -1){
					nodes[key](value);
				} else {
					nodes.attr(key, value);	
				}
            });
        }
		
		return nodes;
    };
	
    return $;
}();