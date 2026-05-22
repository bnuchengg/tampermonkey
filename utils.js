const Utils = {
    isTouchScreen: function () {
        return navigator.maxTouchPoints > 0;
    },
    scroll2Pos: function (pos) {
        scroller.scrollTo({
            top: pos,
            behavior: 'smooth'
        });
    }
};

// 一次性暴露
window.Utils = Utils;
