var Mirror = function() {
	var emptyArray = [];
	var some = emptyArray.some;
	var every = emptyArray.every;
	var slice = emptyArray.slice;
	var filter = emptyArray.filter;
	var methodAttributes = ['val', 'css', 'html', 'text', 'data', 'width', 'height', 'offset'];
	// 紧密化数组
	function compact(array){
		return filter.call(array, function(item){
			return item !== null;
		});
	}
	// 函数化参数处理
	function fnArgument(context, fn, idx, payload){
		return $.type(fn) === 'function' ? fn.call(context, idx, payload) : fn;
	}
	// 混入对象
	function mix(target, source, deep) {
		var keys = Object.keys(source);
		keys.forEach(function(key) {
			var type = $.type(source[key]),
				temp;
			switch (type) {
				case 'undefined':
					break;
				case 'array':
					temp = [];
				case 'object':
					temp = temp || {};
					if (deep) {
						mix(target[key] = temp, source[key], deep);
						break;
					}
				default:
					target[key] = source[key];
			}
		});
		return target;
	}
	// 公用对象
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
		},
		hasClass: function(name){
			if(!name) {
				return false;
			}
			return some.call(this, function(i){
				return i.className.split(' ').indexOf(name) != -1;
			});
		},
		addClass: function(name) {
			if(!name) {
				return this;
			}
			return this.each(function(index){
				if(!('className' in this)){
					return;
				}
				var cls = this.className === '' ? [] : this.className.split(' ');
        		fnArgument(this, name, index, cls).split(/\s+/g).forEach(function(i){
					if (cls.indexOf(i) == -1) {
						cls.push(i);
					}
				});
				this.className = cls.join(' ');
			});
		},
		removeClass: function(name) {
			return this.each(function(index){
				if(!('className' in this)){
					return;
				}
				if(name === undefined){
					return (this.className = '');
				}
				var cls = this.className === '' ? [] : this.className.split(' ');
        		fnArgument(this, name, index, cls).split(/\s+/g).forEach(function(i){
					var idx = cls.indexOf(i);
					if (idx != -1) {
						cls.splice(idx, 1);
					}
				});
				this.className = cls.join(' ');
			});
		},
		toggleClass: function(name, when) {
			if(!name) {
				return this;
			}
			return this.each(function(index){
				var me = $(this);
				var cls = this.className === '' ? [] : this.className.split(' ');
        		fnArgument(this, name, index, cls).split(/\s+/g).forEach(function(i){
					if(when === undefined ? !me.hasClass(i) : when) {
						me.addClass(i);
					} else {
						me.removeClass(i);
					}
				});
			});
		}
	};
	
    // 原型判断
    $.is = function(object) {
        return object instanceof mirror.proto;
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
	// 遍历对象
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
	//扩展对象
	$.extend = function(target) {
        var deep, args = slice.call(arguments, 1);
        if (typeof target == 'boolean') {
            deep = target;
            target = args.shift();
        }
        args.forEach(function(arg) {
            mix(target, arg, deep);
        });
        return target;
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
    
	// 私密对象
    var mirror = {
		// 对象原型
		proto: function(nodes, selector) {
			nodes = nodes || [];
			nodes.__proto__ = $.fn;
			nodes.selector = selector || '';
			return nodes;
		},
		// 初始化
		init: function(selector, context) {
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
						return mirror.fragment(selector, context);
					} else if (context !== undefined) {
						return $(context).find(selector);
					} else {
						nodes = slice.call(document.querySelectorAll(selector));
					}
					break;
			}
			return mirror.proto(nodes, selector);
		},
		//片段构建
		fragment: function(html, properties) {
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
		}
	};
/* 	mirror.proto.prototype = $.fn; */
    return $;
}();