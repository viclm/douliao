var dom = {

    extend: function (childCtor, parentCtor) {
        var fnTest = /\bsuperclass\b/, parent = parentCtor.prototype
        function tempCtor() {};
        if (parent.superclass && !parent.multiSuperclass) {
            parent.multiSuperclass = true;
            for (var name in parent) {
                if (parent.hasOwnProperty(name) && fnTest.test(parent[name])) {
                    parent[name] = (function (name, fn) {
                        return function () {
                            var bak = this.superclass[name];
                            this.superclass[name] = parent.superclass[name];
                            var res = fn.apply(this, arguments);
                            this.superclass[name] = bak;
                            return res;
                        }
                    })(name, parent[name]);
                }
            }
        }
        tempCtor.prototype = parent;
        childCtor.prototype = new tempCtor();
        childCtor.prototype.superclass = parentCtor.prototype;
        childCtor.prototype.constructor = childCtor;
    }

    proxy: function (fn, obj) {
        return function () {
            return fn.apply(obj, arguments);
        }
    }
}
