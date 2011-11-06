(function (window, document, undefined) {


})(this, this.document);

(function (window, document, undefined) {

    function DChat(args) {
        this.sidebar = document.querySelector('#sidebar');
        this.content = document.querySelector('#content');
        this.friendsList = this.sidebar.querySelector('section');
        this.messageList = this.content.querySelector('section');
        this.textbox = this.content.querySelector('footer textarea');
        this.historyList = this.content.querySelector('#history');
        this.miniblogList = this.content.querySelector('#miniblog');
        this.modal = document.querySelector('aside');

        this.current = null;
        this.me = null;
        this.friends = null;
        this.port = null;
        this.msgRequreToken = null;
        this.isLock = false;

        var self = this;

        setTimeout(this.proxy(function () {
            this.historyList.style.height = window.innerHeight - 40 - this.content.querySelector('nav').getBoundingClientRect().height + 'px';
			this.miniblogList.style.height = window.innerHeight - 40 - this.content.querySelector('nav').getBoundingClientRect().height + 'px';
        }, this), 200);

        document.querySelector('nav input').addEventListener('input', this.proxy(this.search, this), false);
        this.delegate(this.friendsList, '.entry', 'click', this.proxy(this.open, this));
        this.delegate(this.friendsList, 'input', 'click', this.proxy(this.delete, this));
        this.sidebar.querySelector('footer input').addEventListener('click', this.proxy(this.edit, this), false);
        this.sidebar.querySelector('footer input:last-of-type').addEventListener('click', this.proxy(function () {
            this.modal.style.display = 'block';
        }, this), false);


        this.textbox.parentNode.addEventListener('submit', this.proxy(this.send, this), false);
        this.textbox.addEventListener('input', function (e) {
            var diff = this.scrollHeight - this.offsetHeight, r, p;
            if (diff) {
				this.style.height = 'auto';
				this.style.height = this.scrollHeight + 'px';
				if (this.value.trim().length === 0) {
					this.style.height = '28px';
				}
                self.messageList.style.height = innerHeight - 10 - self.content.querySelector('footer').getBoundingClientRect().height + 'px';
            }
        }, false);
        this.textbox.addEventListener('keydown', this.proxy(function (e) {
            if (e.keyCode === 13 && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.send(e);
                return false;
            }
        }, this), false);

        this.delegate(this.content.querySelector('nav'), 'a', 'click', this.proxy(function (e) {
            if (e.target.className !== 'active') {
                this.content.querySelector('nav a[class=active]').className = '';
                e.target.className = 'active';
                this.historyList.parentNode.style.webkitTransitionProperty = '-webkit-transform';
                this.content.querySelector('#misc>div').style.webkitTransform = 'translate(-'+ (parseInt(e.target.href.slice(-1), 10)-1) * 50 +'%, 0)';
                if (e.target.firstChild.nodeValue == '豆瓣说') {
                    if (this.miniblogList.children.length === 0) {
                        this.port.postMessage({cmd: 'fetchMiniblog', people: self.current, offset: 0});
                    }
                }
            }
            e.preventDefault();
            return false;
        }, this));
        this.delegate(this.historyList, 'a.more', 'click', function (e) {
            self.port.postMessage({cmd: 'fetchHistory', people: self.current, offset: self.content.querySelectorAll('#chat div, #history div').length});
            e.preventDefault();
        });
        this.delegate(this.miniblogList, 'a.more', 'click', function (e) {
            self.port.postMessage({cmd: 'fetchMiniblog', people: self.current, offset: self.miniblogList.children.length-1, latest: e.target.timestamp});
            e.preventDefault();
        });
		this.delegate(this.miniblogList, 'div a', 'click', function (e) {
            window.open(this.href);
            e.preventDefault();
			return false;
        });
		this.delegate(this.miniblogList, 'img', 'click', function (e) {
			var width = this.parentNode.getBoundingClientRect().width * 0.8 - 10, img = this;
			if (this.offsetWidth === 100) {
				this.style.width = width + 'px';
				setTimeout(function () {
				self.once(document.body, 'click', function (e) {
					img.style.width = '100px';
				});
				}, 0);
			}
            e.preventDefault();
        });


        this.modal.querySelector('span').addEventListener('click', this.proxy(function () {
            this.modal.style.display = 'none';
        }, this), false);
        this.modal.querySelector('form').addEventListener('submit', this.proxy(this.add, this), false);
        this.modal.querySelector('input[type=button]').addEventListener('click', function () {
            self.port.postMessage({cmd: 'addAllFriends'});
            self.modal.style.display = 'none';
        }, false);

        this.tmpMsg = document.createElement('p');
        this.tmpMsg.className = 'tmpMsg';
        this.tmpMsg.addEventListener('webkitTransitionEnd', function () {
            this.real.style.visibility = 'visible';
            this.style.display = 'none';
            this.style.webkitTransform = 'translate(0, 0)';
        }, false);
        document.body.appendChild(this.tmpMsg);

        chrome.extension.sendRequest({cmd: 'initial'}, function(response) {
            var friends = response.friends, key, div;

            for (key in friends) {
                div = document.createElement('div');
                div.className = 'entry';
                div.id = key;
                div.innerHTML = '<input type="button" value="删除" /><div><h2>' + friends[key].name + '</h2><p> ' + friends[key].sign + ' </p></div><img src="' + friends[key].icon + '" />';
                self.friendsList.appendChild(div);

                friends[key].unread = [];
            }

            self.me = response.me;
            var image = new Image();
            image.onload = function () {
                self.me.oldIcon = self.greyscale(image);
            }
            image.src = response.me.icon;
            self.friends = friends;
            self.start();

            if (response.current) {
                self.open({target: document.getElementById(response.current.people)});
            }

            key = 0;console.log(document.getElementById(response.unread))
            while (key < response.unread.length) {
                delete response.unread[key].cmd;
                self.receive(response.unread[key]);
                key += 1;
            }
        });
    }

    DChat.prototype.proxy = function (fn, obj) {
        return function () {
            return fn.apply(obj, arguments);
        }
    };

	DChat.prototype.once = function (node, event, fn) {
		var newFn = function () {
            node.removeEventListener(event, newFn, false);
            fn.apply(node, arguments);
        };
        node.addEventListener(event, newFn, false);
	},

    DChat.prototype.delegate = function (node, selector, type, handler) {
        node.delegate || (node.delegate = {});
        node.delegate[selector] = {handler: handler};
        this.delegate.nodeList || (this.delegate.nodeList = []);
        if (this.delegate.nodeList.indexOf(node) === -1) {
            node.addEventListener(type, function (e) {
                var target = e.target, key, tmp;
                do {
                    for (key in node.delegate) {
                        tmp = node.delegate[key];
                        if (Array.prototype.indexOf.call(node.querySelectorAll(key), target) > -1) {
                            delete e.target;
                            e.target = target;
                            tmp.handler.call(target, e);
                            return;
                        }
                    }
                    target = target.parentNode;
                }
                while (target && target !== this);
            }, false);
            this.delegate.nodeList.push(node);
        }
    };

    DChat.prototype.start = function () {
        var self = this;
        this.port = chrome.extension.connect({name: 'dchat'});
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
                delete msg.cmd;
                self.receive(msg);
                break;
            case 'join':
                delete msg.cmd;
                if (!self.friends[msg.people]) {
                    var div = document.createElement('div');
                    div.className = 'entry';
                    div.id = msg.people;
                    div.innerHTML = '<input type="button" value="删除" /><div><h2>' + msg.name + '</h2><p> ' + msg.sign + ' </p></div><img src="' + msg.icon + '" />';
                    self.friendsList.appendChild(div);
                    msg.unread = [];
                    self.friends[msg.people] = msg;
                }

                if (msg.active !== false) {
                    self.open({target: document.getElementById(msg.people)});
                }
                break;
            case 'mergeHistory':
                if (msg.people === self.current) {
                    var i = 0, len = msg.history.length, item, image, more;
                    for (; i < len ; i += 1) {
                        item = msg.history[i];
                        if (item.f === 'ta') {
                            self.addContent('<img src="' + self.friends[msg.people].oldIcon + '"><p>' + item.content + '  ' + self.strftime(item.timestamp) + '</p>', 'left old', true);
                        }
                        else {
                            self.addContent('<img src="' + self.me.oldIcon + '"><p>' + item.content + '  ' + self.strftime(item.timestamp) + '</p>', 'right old', true);
                        }
                    }

                    more = self.historyList.querySelector('.more');
                    if (msg.final) {
                        if (more) {
                            self.historyList.removeChild(more);
                        }
                    }
                    else {
                        if (!more) {
                            more = document.createElement('a');
                            more.href = '#';
                            more.className = 'more';
                            more.innerHTML = '更多';
                        }
                        self.historyList.insertBefore(more, self.historyList.firstChild);
                    }
                    self.friends[msg.people].gina = true;
                }
                break;
            case 'mergeMiniblog':
                if (msg.people === self.current) {
                    var i = 0, len = msg.miniblog.length, div, image, more;
                    for (; i < len ; i += 1) {
                        div = self.addMiniblog(msg.miniblog[i].content, false);
						if (msg.miniblog[i].photo) {
							image = document.createElement('img');
							image.src = msg.miniblog[i].photo;
							div.appendChild(image);
						}
                    }

                    more = self.miniblogList.querySelector('.more');
                    if (msg.final) {
                        if (more) {
                            self.miniblogList.removeChild(more);
                        }
                    }
                    else {
                        if (!more) {
                            more = document.createElement('a');
                            more.href = '#';
                            more.className = 'more';
                            more.innerHTML = '更多';
                        }
                        self.miniblogList.appendChild(more);
                    }
                }
                break;
            }
        });
    };

    DChat.prototype.search = function (e) {
        var keyword = e.target.value, key, reg = new RegExp(keyword, 'i'), first;
        for (key in this.friends) {
            if (reg.test(this.friends[key].name)) {
                document.getElementById(key).style.display = 'block';
                if (first === undefined) {
                    first = document.getElementById(key);
                }
            }
            else {
                document.getElementById(key).style.display = 'none';
            }
        }
        if (first) {
            this.open({target: first});
        }
        else if (this.current) {
            this.close();
        }
    };

    DChat.prototype.open = function (e) {
        var target = e.target, id = target.id, i, len, self = this;
        if (this.current !== id) {
            if (this.current) {
                this.close();
            }
            
                this.content.style.left = '25%';
            

            this.historyList.parentNode.style.webkitTransitionProperty = 'none';
            this.historyList.parentNode.style.webkitTransform = 'translate(0, 0)';
            this.content.querySelector('nav a[class=active]').className = '';
            this.content.querySelector('nav a').className = 'active';
            this.messageList.innerHTML = this.friends[id].message || '';
            this.historyList.innerHTML = this.friends[id].history || '';
            this.miniblogList.innerHTML = '';
            for (i = 0, len = this.friends[id].unread.length ; i < len ; i += 1) {
                this.addContent('<img src="' + this.friends[id].unread[i].icon + '"><p>' + this.friends[id].unread[i].content + '</p>', 'left');
            }
            if (len > 0) {
                this.friends[id].unread = [];
                target.querySelector('h2').removeChild(target.querySelector('h2 span'));
                chrome.extension.sendRequest({cmd: 'setUnread', unread: id});
            }

            /*if (this.current) {
                document.getElementById(this.current).className = 'entry';
            }
            else {
                this.content.style.left = '25%';
            }*/
            target.className = 'entry active';
            this.current = id;
            if (this.friends[id].gina === undefined) {
                this.port.postMessage({cmd: 'fetchHistory', people: id, offset: this.messageList.querySelectorAll('div').length});
                this.port.postMessage({cmd: 'updateFriend', people: id});
                this.friends[id].oldIcon = this.greyscale(document.getElementById(id).querySelector('img'));
            }
        }
    };

    DChat.prototype.close = function () {
        var entry = document.getElementById(this.current);
        entry.className = 'entry';
        this.friends[this.current].message = this.messageList.innerHTML;
        this.friends[this.current].history = this.historyList.innerHTML;
        //this.friends[this.current].miniblog = this.miniblogList.innerHTML;
        this.current = null;
        this.content.style.left = '-50%';
    };

    DChat.prototype.edit = function (e) {
        var input = this.friendsList.querySelectorAll('input'), i, len;
        if (e.target.value === '编辑') {
            for (i = 0, len = input.length ; i < len ; i += 1) {
                input[i].style.display = 'block';
            }
            e.target.value = '完成'
        }
        else {
            for (i = 0, len = input.length ; i < len ; i += 1) {
                input[i].style.display = 'none';
            }
            e.target.value = '编辑'
        }
    };

    DChat.prototype.add = function (e) {
        e.preventDefault();
        var reg = /http:\/\/www.douban.com\/people\/[^\/]+\//i, url;
        url = reg.exec(this.modal.querySelector('input').value);
        if (url) {
            this.port.postMessage({cmd: 'addFriend', url: url[0]});
            this.modal.querySelector('p').style.display = 'none';
            this.modal.style.display = 'none';
            this.modal.querySelector('input').value = '';
        }
        else {
            this.modal.querySelector('p').style.display = 'block';
        }
    };

    DChat.prototype.delete = function (e) {
        var entry = e.target.parentNode;
        if (entry.id === this.current) {
            delete this.friends[this.current];
            this.current = null;
            this.content.style.left = '-50%';
        }
        this.port.postMessage({cmd: 'deleteFriend', people: entry.id});
        this.friendsList.removeChild(entry);
        e.stopPropagation();
    };

    DChat.prototype.send = function (e) {
        var value = this.textbox.value.trim(), self = this;
        e.preventDefault();
        if (value !== '') {
            if (this.msgRequreToken) {
                this.port.postMessage({
                    cmd: 'send',
                    content: self.msgRequreToken.content,
                    people: self.msgRequreToken.people,
                    captcha: {
                        token: self.msgRequreToken.captcha.token,
                        string: value
                    }
                });
                this.messageList.removeChild(this.msgRequreToken.captcha.dom);
                this.msgRequreToken = null;
            }
            else {
                var newMsg = this.addContent('<img src="' + this.me.icon + '"><p>' + value + '</p>', 'right'), sPosition, tPosition;
                sPosition = newMsg.querySelector('p').getBoundingClientRect();
                tPosition = this.textbox.getBoundingClientRect();
                this.tmpMsg.real = newMsg;
                this.tmpMsg.innerHTML = value;
                this.tmpMsg.style.cssText = 'display: block; left: ' + tPosition.left + 'px; top: ' + tPosition.top + 'px; height: 28px; width: ' + tPosition.width + 'px;';
                newMsg.style.visibility = 'hidden';
                setTimeout(function () {
                    self.tmpMsg.style.webkitTransform = 'translate(' + (sPosition.left - tPosition.left) + 'px, ' + (sPosition.top - tPosition.top) + 'px)';
                    self.tmpMsg.style.width = sPosition.width + 'px';
                    self.tmpMsg.style.height = sPosition.height + 'px';
                }, 0);
                this.port.postMessage({cmd: 'send', content: value, people: self.current});
            }

            this.textbox.value = '';
        }
    };

    DChat.prototype.receive = function (msg) {console.log(msg, this.friends)
        if (this.current === msg.people) {
            this.addContent('<img src="' + msg.icon + '"><p>' + msg.content + '</p>', 'left');
            //self.lock(false);
        }
        else if (msg.people in this.friends) {
            if (this.friends[msg.people].unread.length === 0) {
                this.friends[msg.people].unread.push(msg);
                var indicator = document.createElement('span');
                indicator.innerHTML = '1';
                document.getElementById(msg.people).querySelector('h2').appendChild(indicator);
            }
            else {
                this.friends[msg.people].unread.push(msg);
                document.getElementById(msg.people).querySelector('h2 span').innerHTML = this.friends[msg.people].unread.length;
            }
        }
        else {
            this.friends[msg.people] = {
                name: msg.name,
                icon: msg.icon,
                sign: '',
                unread: [msg]
            };

            var div = document.createElement('div');
            div.className = 'entry';
            div.id = msg.people;
            this.friendsList.appendChild(div);
            div.innerHTML = '<input type="button" value="删除" /><div><h2>' + msg.name + '<span>1</span></h2><p></p></div><img src="' + msg.icon + '" />';
        }
        this.friendsList.insertBefore(document.getElementById(msg.people), this.friendsList.querySelector('div'));
    };

    DChat.prototype.addContent = function (html, className, first) {
        var div = document.createElement('div'), scrollHeight = this.messageList.scrollHeight;
        div.className = className;
        div.innerHTML = html;
        if (first) {
            this.historyList.insertBefore(div, this.historyList.querySelector('div'));
        }
        else {
            this.messageList.appendChild(div);
        }
        if (div.getElementsByTagName('img').length > 0) {
            scrollHeight += 41;
        }
        this.messageList.scrollTop = scrollHeight;
        return div;
    };

    DChat.prototype.addMiniblog = function (html, first) {
        var div = document.createElement('div'), scrollHeight = this.miniblogList.scrollHeight;
        div.innerHTML = html;
		if (first) {
			this.miniblogList.insertBefore(div, this.miniblogList.firstChild);
		}
		else {
			this.miniblogList.appendChild(div);
		}
        this.miniblogList.scrollTop = scrollHeight;
        return div;
    };

    DChat.prototype.greyscale = function (image) {
        var canvas, ctx, imageData, pixels, numPixels, i, average, width, height;
        width = image.width;
        height = image.height;
        canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);
        imageData = ctx.getImageData(0, 0, width, height);
        pixels = imageData.data;
        numPixels = pixels.length;
        ctx.clearRect(0, 0, width, height);
        for (i = 0; i < numPixels; i += 1) {
            average = (pixels[i*4]+pixels[i*4+1]+pixels[i*4+2])/3;
            pixels[i*4] = average; // Red
            pixels[i*4+1] = average; // Green
            pixels[i*4+2] = average; // Blue
        };
        ctx.putImageData(imageData, 0, 0);
        return canvas.toDataURL();
    }

    DChat.prototype.strftime = function (time) {
        var now = new Date(), time = new Date(time), str, modifier;
        if (modifier = now.getFullYear() - time.getFullYear()) {
            modifier += '年前';
        }
        else if (modifier = now.getMonth() - time.getMonth()) {
            modifier += '月前';
        }
        else if (modifier = now.getDate() - time.getDate()) {
            if (modifier === 1) {
                modifier = '昨天';
            }
            else if (modifier === 2) {
                modifier = '前天';
            }
            else {
                modifier += '天前';
            }
        }

        str = (time.getHours() > 9 ? time.getHours() : '0' + time.getHours()) + ' : ' + (time.getMinutes() > 9 ? time.getMinutes() : '0' + time.getMinutes());
        if (modifier) {
            str = modifier + ' ' + str;
        }
        return str;
    };

    DChat.prototype.strftime = function (time) {
        var time = new Date(time), str;
        str = time.getMonth() + 1 + '月' + time.getDate() + '日 ';
        str += (time.getHours() > 9 ? time.getHours() : '0' + time.getHours()) + ' : ' + (time.getMinutes() > 9 ? time.getMinutes() : '0' + time.getMinutes());
        return str;
    };

    DChat.prototype.lock = function (status) {
        this.textbox.disabled = status;
        this.textbox.style.backgroundColor = status ? '#ddd' : '#fff';
        this.textbox.value = status ? '双击鼠标来解锁' : '';
        this.friends[this.current].isLock = status;
    };

    new DChat();

})(this, this.document);
