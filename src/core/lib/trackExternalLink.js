// ../utils/uploadEvent.js

Keen.prototype.trackExternalLink = function(jsEvent, eventCollection, payload, timeout, timeoutCallback){

  var evt = jsEvent,
      target = (evt.currentTarget) ? evt.currentTarget : (evt.srcElement || evt.target),
      timer = timeout || 500,
      triggered = false,
      targetAttr = "",
      callback,
      win;

  if (target.getAttribute !== void 0) {
    targetAttr = target.getAttribute("target");
  } else if (target.target) {
    targetAttr = target.target;
  }

  if ((targetAttr == "_blank" || targetAttr == "blank") && !evt.metaKey) {
    win = window.open("about:blank");
    win.document.location = target.href;
  }

  if (target.nodeName === "A") {
    callback = function(){
      if(!triggered && !evt.metaKey && (targetAttr !== "_blank" && targetAttr !== "blank")){
        triggered = true;
        window.location = target.href;
      }
    };
  } else if (target.nodeName === "FORM") {
    callback = function(){
      if(!triggered){
        triggered = true;
        target.submit();
      }
    };
  } else {
    Keen.log("#trackExternalLink method not attached to an <a> or <form> DOM element");
  }

  if (timeoutCallback) {
    callback = function(){
      if(!triggered){
        triggered = true;
        timeoutCallback();
      }
    };
  }
  _uploadEvent.call(this, eventCollection, payload, callback, callback);

  setTimeout(callback, timer);

  if (!evt.metaKey) {
    return false;
  }
};
