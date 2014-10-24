;(function($) {

    var stylesheets = {};

    var css = function(name){
        this.name = name;
        this.stylesheet = $('<style></style>').appendTo('head');
    }
    css.prototype = {
        append: function(style){
            this.stylesheet.append(document.createTextNode(style));
            return this;
        },
        write: function(style){
            this.stylesheet.html(style);
            return this;
        },
        disable: function(value){
            this.stylesheet.get(0).disabled = value === undefined || !!value;
            return this;
        },
        remove: function(){
            this.stylesheet.remove();
            delete stylesheets[this.name];
        }
    }

    $.css = function(name) {
        name = name || 'default';
        return stylesheets[name] || (stylesheets[name] = new css(name));
    };

}(Mirror));