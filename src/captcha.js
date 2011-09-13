var people = /html#([^#]+)$/.exec(location.href)[1];
chrome.extension.sendRequest({cmd: "getCaptcha", people: people}, function(response) {
	document.querySelector('img').src = response.url;
});

document.querySelector('form').addEventListener('submit', function (e) {
	e.preventDefault();
	var string = this.querySelector('input[type=text]').value;
	console.log(string)
	chrome.extension.sendRequest({cmd: 'sendHistory', string: string, people: people});
	window.close();
	return false;
}, false);
