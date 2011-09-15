var header = document.querySelector('header'), entryList = document.querySelector('section'), contextmenu;


function openPanel(e) {
    if (e.detail > 1) {
        var response = {cmd: 'createWindow'};
        response.people = this.id;
        response.name = this.querySelector('h2').innerHTML;
        response.sign = this.querySelector('p').innerHTML;
        response.icon = this.querySelector('img').src;
        response.updateFriend = true;
        response.history = [];
        chrome.extension.sendRequest(response);
        e.preventDefault();
        return false;
    }
}

function openContextmenu(e) {
    contextmenu.rel = this;
    contextmenu.style.left = e.pageX + 'px';
    contextmenu.style.top = e.pageY + 'px';
    contextmenu.style.display = '';
    e.stopPropagation();
}

chrome.extension.sendRequest({cmd: 'getList'}, function(response) {
    var me = response.me, friends = response.friends, key, div;
    //header.querySelector('h1').appendChild(document.createTextNode(me.name));
    //header.querySelector('p').appendChild(document.createTextNode(me.sign));
    //header.querySelector('img').src = me.icon;

    contextmenu = document.createElement('div');
    contextmenu.innerHTML = '删除好友';
    contextmenu.className = 'contextmenu';
    contextmenu.style.display = 'none';
    contextmenu.addEventListener('click', function (e) {
        var people = this.rel.id;
        chrome.extension.sendRequest({cmd: 'deleteFriend', people: people});
        entryList.removeChild(this.rel);
        this.rel = undefined;
    }, false);
    document.body.appendChild(contextmenu);
    document.body.addEventListener('click', function (e) {
        contextmenu.style.display = 'none';
    }, false);


    for (key in friends) {
        div = document.createElement('div');
        div.className = 'entry';
        div.id = key;
        div.innerHTML = '<div><h2>' + friends[key].name + '</h2><p> ' + friends[key].sign + ' </p></div><img src="' + friends[key].icon + '" />';
        div.addEventListener('click', openPanel, false);
        div.addEventListener('contextmenu', openContextmenu, false);
        entryList.appendChild(div);
    }
});

(function (window, document, undefined) {

	function Main() {
		this.sidebar = document.querySelector('#sidebar');
		this.content = document.querySelector('#content');
		this.msgList = this.content.querySelector('section');
		this.textbox = this.content.querySelector('footer form');

		this.current = null;

		this.delegate(this.sidebar.querySelector('section'), '.entry', 'click', this.proxy(this.open, this));
		this.content.querySelector('header input').addEventListener('click', this.proxy(this.close, this), false);

		this.start();
	};

	Main.prototype.delegate = function (node, selector, type, handler) {
		var result = /^([a-z]+)?(?:\.(.+))?$/.exec(selector), nodeName, className;
		nodeName = result[1];
		className = result[2];
		node.addEventListener(type, function (e) {
			var target = e.target;
			do {
				if ((nodeName === undefined || target.nodeName === nodeName) && (className === undefined || target.className === className)) {
					delete e.target;
					e.target = target;
					handler(e);
					break;
				}
				target = target.parentNode;
			} 
			while (target !== this);
		}, false);
	};

	Main.prototype.proxy = function (fn, obj) {
		return function () {
			return fn.apply(obj, arguments);
		}
	};

	Main.prototype.open = function (e) {
		var target = e.target;
		if (this.current !== target.id) {
			this.msgList.innerHTML = target.rel || '';
			if (this.current) {
				document.getElementById(this.current).className = 'entry';
			}
			else {
				this.content.style.left = '30%';
			}
			target.className = 'entry active';
			this.current = target.id;
		}
	};

	Main.prototype.close = function () {
		var entry = document.getElementById(this.current);
		entry.className = 'entry';
		entry.rel = this.msgList.innerHTML;
		this.current = null;
		this.content.style.left = '-40%';
	};

	Main.prototype.start = function () {
        var self = this;

        this.port = chrome.extension.connect({name: 'dchat'});
        this.port.postMessage({cmd: 'receivestart'});
        this.port.onMessage.addListener(function (msg) {
            switch (msg.cmd) {
            case 'sended':
                if (!msg.result) {
                    var captcha = self.addContent('<p>发送太快了亲，输入验证码</p><img src="' + msg.msg.captcha.string + '">', 'captcha');
                    self.msgRequreToken = msg.msg;
                    self.msgRequreToken.captcha.dom = captcha;
                    self.lock(false);
                }
                break;
            case 'received':
                if (self.people === msg.people) {
                    self.addContent('<img src="' + self.icon + '"><p>' + msg.content + '</p>', 'left');
                    self.lock(false);
                }
                break;
            }
        });
    };

	new Main();
})(this, this.document);


