const Utils = {
    resetPos: function () {
        scroll2Pos(0);
        isScrollDown = true;
        contextMenu.replaceChildren(liBottom); // 用参数替换所有子元素?
    },
    toggleButton: function () {
        isScrollDown = !isScrollDown;
        isScrollDown ? contextMenu.replaceChildren(liBottom) : contextMenu.replaceChildren(liTop);
    },
    zoomNext: function (img) {
        const imgs = Array.from(document.querySelectorAll("img")).filter(img => img.getBoundingClientRect().height >= 150); // 隐藏图片的getBoundingClientRect返回的height为0?
        const index = Number(imgs.map((item, index) => {
            item.setAttribute("data-index", index);
            return item;
        }).filter(item => item == img)[0]?.getAttribute("data-index"));
        const next = isScrollDown ? index + 1 : index - 1;
        imgs[next]?.classList.add("zoomed");
    },
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
