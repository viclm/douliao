/**
* hg.Slideshow is abstract class for slideshow, inherit it if you want a slideshow on webpage
*
* @author viclm
* @version 20110623.4
* @constructs
* @requires jQuery
* @param {Number} [gap=5000] The rate of slideshow plays
* @param {length} length The number of slides
* @param {Boolean} [loop=true] Indicate whether the slideshow plays loop
* @param {Integer} [step=1] The step of slideshow moves
*/
function Slideshow(args) {

    this.gap = 5000;
    this.length = null;
    this.loop = null;
    this.step = 1;
    this.callback = null;

    Sherry.clone(this, arguments[0] || {});

    this.count = 1;
    this.timer = null;
}
/**
* reset the slideshow
* @public
*/
Slideshow.prototype.reset = function () {
    this.count = 1;
    return this;
}
/**
* start playing the slideshow
* @public
*/
Slideshow.prototype.start = function () {
    var self = this;
    if (!this.timer) {
        this.timer = setInterval(function () {
            self.next();//modify in 7.6
        }, this.gap);
    }
}
/**
* stop playing the slideshow
* @public
*/
Slideshow.prototype.stop = function () {
    clearInterval(this.timer);
    this.timer = null;
}
/**
* move to a special slide
* @public
* @param {Integer} index The No. of slide
* @returns {Integer} The No. of slide moved to, return -1 if moving failed(e.g., move to current slide)
*/
Slideshow.prototype.moveTo = function (index) {
    var res = index;
    if (this.count !== index) {
        this.count = index;
    }
    else {
        res = -1;
    }
    typeof this.callback === 'function' && this.callback(res);
    return res;
}
/**
* move to next slide
* @public
* @returns {Integer} The No. of slide moved to, return -1 if moving failed(e.g., move to current slide)
*/
Slideshow.prototype.prev = function () {
    var target = this.count - this.step;
    if (target < 1) {
        if (this.loop) {
            target = this.length + target;
        }
        else {
            target = 1;
        }
    }
    return this.moveTo(target);
}
/**
* move to previous slide
* @public
* @returns {Integer} The No. of slide moved to, return -1 if moving failed(e.g., move to current slide)
*/
Slideshow.prototype.next = function () {
    var target = this.count + this.step;
    if (target > this.length) {
        if (this.loop) {
            target = target - this.length;
        }
        else {
            target = this.length;
        }
    }
    return this.moveTo(target);
}
