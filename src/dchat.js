(function (window, document, undefined) {

    function DChat(args) {
        this.sidebar = document.querySelector('#sidebar');
        this.content = document.querySelector('#content');
        this.friendsList = this.sidebar.querySelector('section');
        this.messageList = this.content.querySelector('section');
        this.textbox = this.content.querySelector('footer input[type=text]');
        this.modal = document.querySelector('aside');

        this.current = null;
        this.me = null;
        this.friends = null;
        this.port = null;
        this.msgRequreToken = null;
        this.isLock = false;

        this.delegate(this.friendsList, '.entry', 'click', this.proxy(this.open, this));
        this.delegate(this.friendsList, 'input', 'click', this.proxy(this.delete, this));
        //this.content.querySelector('header input').addEventListener('click', this.proxy(this.close, this), false);
        this.textbox.parentNode.addEventListener('submit', this.proxy(this.send, this), false);
        this.sidebar.querySelector('footer input').addEventListener('click', this.proxy(this.edit, this), false);
        this.sidebar.querySelector('footer input:last-of-type').addEventListener('click', this.proxy(function () {
            this.modal.style.display = 'block';
        }, this), false);
        this.modal.querySelector('span').addEventListener('click', this.proxy(function () {
            this.modal.style.display = 'none';
        }, this), false);
        this.modal.querySelector('form').addEventListener('submit', this.proxy(this.add, this), false);
        this.content.addEventListener( 'webkitTransitionEnd', function (e) {
            if (self.current) {this.style.left = '30%';}
        }, false )

        var self = this;
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

    DChat.prototype.delegate = function (node, selector, type, handler) {
        var result = /^([a-z]+)?(?:\.(.+))?$/i.exec(selector), nodeName, className, self = this;
        nodeName = result[1];
        className = result[2];
        this.delegate.save || (this.delegate.save = {});
        this.delegate.nodeList || (this.delegate.nodeList = []);
        this.delegate.save[selector] = {nodeName: nodeName, className: className, handler: handler};
        if (this.delegate.nodeList.indexOf(node) === -1) {
            node.addEventListener(type, function (e) {
                var target = e.target, key, tmp;
                do {
                    for (key in self.delegate.save) {
                        tmp = self.delegate.save[key];
                        if ((tmp.nodeName === undefined || target.nodeName.toLowerCase() === tmp.nodeName) && (tmp.className === undefined || target.className === tmp.className)) {
                            delete e.target;
                            e.target = target;
                            tmp.handler(e);
                            return;
                        }
                    }
                    target = target.parentNode;
                }
                while (target !== this);
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

                self.open({target: document.getElementById(msg.people)});
                break;
            case 'mergeHistory':console.log(msg, 1)
                if (msg.people === self.current) {
					var i = 0, len = msg.history.length, item, image;
					if (len > 0) {
						self.addContent('<p>' + new Date(msg.history[0].timestamp).getHours() + ':' + new Date(msg.history[0].timestamp).getMinutes() + '</p>', 'time', true);
						image = self.greyscale(document.getElementById(msg.people).querySelector('img'));
					}
                    for (; i < len ; i += 1) {
                        item = msg.history[i];
                        if (item.f === 'ta') {
                            self.addContent('<img src="' + image + '"><p>' + item.content + '</p>', 'left old', true);
                        }
                        else {
                            self.addContent('<img src="' + self.me.oldIcon + '"><p>' + item.content + '</p>', 'right old', true);
                        }
                    }
                    self.friends[msg.people].gina = true;
                }
                break;
            }
        });
    };

    DChat.prototype.open = function (e) {
        var target = e.target, id = target.id, i, len, self = this;
        if (this.current !== id) {console.log(this.current, id)
            if (this.current) {
                this.friends[this.current].history = this.messageList.innerHTML;
            }
            this.messageList.innerHTML = this.friends[id].history || '';
            for (i = 0, len = this.friends[id].unread.length ; i < len ; i += 1) {
                this.addContent('<img src="' + this.friends[id].unread[i].icon + '"><p>' + this.friends[id].unread[i].content + '</p>', 'left');
                //this.lock(false);
            }
            if (len > 0) {
                this.friends[id].unread = [];
                target.querySelector('h2').removeChild(target.querySelector('h2 span'));
                chrome.extension.sendRequest({cmd: 'setUnread', unread: id});
            }

            if (this.current) {
                document.getElementById(this.current).className = 'entry';
                this.content.style.left = '-40%';
            }
            else {
                this.content.style.left = '30%';
            }
            target.className = 'entry active';
            this.current = id;
            if (this.friends[id].gina === undefined) {
                this.port.postMessage({cmd: 'fetchHistory', people: id, offset: this.content.querySelectorAll('div').length});
            }
        }
    };

    DChat.prototype.close = function () {
        var entry = document.getElementById(this.current);
        entry.className = 'entry';
        this.friends[this.current].history = this.messageList.innerHTML;
        this.current = null;
        this.content.style.left = '-40%';
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
            this.content.style.left = '-40%';
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
                this.addContent('<img src="' + this.me.icon + '"><p>' + value + '</p>', 'right');
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
			this.messageList.insertBefore(div, this.messageList.querySelector('div'));
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

    DChat.prototype.lock = function (status) {
        this.textbox.disabled = status;
        this.textbox.style.backgroundColor = status ? '#ddd' : '#fff';
        this.textbox.value = status ? '双击鼠标来解锁' : '';
        this.friends[this.current].isLock = status;
    };

    new DChat();

})(this, this.document);
