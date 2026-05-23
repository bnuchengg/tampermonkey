const Utils = {
    isScrollDown: true,
    iframeCnt: 0,
    observer: new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting && !entry.target.paused && entry.target.controls)
                entry.target.pause();
        });
    }, {threshold: 0.5}),
    ss: {
        set(key, value) {
            if (typeof value == "object")
                value = JSON.stringify(value);
            localStorage.setItem(key, value);
        },
        hashSet(key, field, value) {
            const map = this.getJson(key);
            map[field] = value;
            this.set(key, map);
        },
        hashGet(key, field) {
            return this.getJson(key)[field];
        },
        add(arr, item) {
            const _arr = this.getArray(arr);
            if (!_arr.includes(item))
                _arr.push(item);
            this.set(arr, _arr);
        },
        contains(arr, item) {
            return this.getArray(arr).includes(item);
        },
        get(key) {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        },
        getJson(key) {
            if (!this.get(key))
                this.set(key, {});
            return this.get(key);
        },
        getArray(key) {
            if (!this.get(key))
                this.set(key, []);
            return this.get(key);
        },
        size(key) {
            return localStorage.getItem(key)?.length ?? 0;
        },
        remove(key) {
            localStorage.removeItem(key);
        },
        clear() {
            localStorage.clear();
        }
    },
    mergeLink: function (div) {
        if (div.querySelectorAll("a").length > 1) {
            const img = div.querySelector("a img");
            const parent = div == img.closest("div") ? img.closest("a") : img.closest("div");
            div.prepend(img);
            parent?.remove();
        }
        return div;
    },
    lazyLoad: function (ele, target, func) {
        const timer = setInterval(() => {
            const content = ss.hashGet("cacheMap", ele.href) || pageCache[ele.href];
            if (content) {
                clearInterval(timer);
                eval(func);
            } else if (!/loading/.test(ele.classList))
                loadContent(ele, target);
        }, 1000);
    },
    appendDiv: function (type) {
        return ele => {
            if (/\/search/i.test(document.URL)) {
                const container = document.createElement("div");
                container.style.cssText = "max-width: 100px !important; flex-shrink: 0";
                if (/img/i.test(type))
                    container.innerHTML = `<img src="${ele.poster || ele.src}" style="width: auto; max-height: 100px"/>
                        <span style="position: absolute; top: 0; right: 20px; font-size: 10px !important">${ele.tagName}</span>`;
                else
                    container.textContent = ele.textContent.slice(0, 35) + "…";
                ele.closest("article")?.append(container);
                ele.closest("[aria-labelledby]")?.remove();
            }
        };
    },
    visitLink: function () {
        return ele => {
            const arr = "vLinks";
            const link = ele.href || ele.textContent;
            if (ss.contains(arr, link))
                ele.classList.add("visited");
            else
                ele.onclick = () => ss.add(arr, link);
        };
    },
    loadContent: function (link, selector, cloneLink) {
        const key = "cacheMap";
        if (ss.hashGet(key, link.href) || pageCache[link.href])
            return;
        link.classList.add("loading");
        const iframe = document.createElement("iframe");
        if (/club.kdslife/.test(host))
            iframe.style.cssText = "width: 1080px";
        else
            iframe.style.cssText = "display: none";
        iframe.src = link.href;
        iframe.onload = (e) => {
            const iframe = e.target;
            const timer = setInterval(() => {
                if (iframe.contentDocument?.querySelector(selector)) {
                    clearInterval(timer);
                    const content = iframe.contentDocument?.querySelector(selector);
                    if (cloneLink)
                        content.prepend(link.cloneNode(true));
                    if (ss.size(key) < 5e6)
                        ss.hashSet(key, link.href, content.outerHTML);
                    else
                        pageCache[link.href] = content.outerHTML;
                    link.classList.remove("loading");
                    this.iframeCnt--;
                    iframe.remove();
                }
            }, 1000);
        };
        const timer = setInterval(() => {
            if (this.iframeCnt < 3) {
                this.iframeCnt++;
                clearInterval(timer);
                document.body.append(iframe);
            }
        }, 1000);
    },
    createNode: function (tagName, cssText, action) {
        const map = {"top": "⏫", "bottom": "⏬"};
        const node = document.createElement(tagName);
        node.textContent = map[action];
        node.style.cssText = `${cssText}`;
        node.onclick = () => menuAction(action);
        return node;
    },
    moveImg: function (e) {
        const img = e.target;
        if (img.classList.contains("video_play") || img.getBoundingClientRect().height < 150)
            return;
        e.preventDefault();
        e.stopPropagation();
        let pos = 0;
        if (!img.classList.contains("zoomed")) {
            img.classList.add("zoomed");
            pos = calcScrollPos(img, true);
        } else {
            zoomNext(img);
            pos = calcScrollPos(img, false);
        }
        scroll2Pos(pos);
    },
    calcScrollPos: function (img, firstClick) {
        const scrollTop = scroller.scrollTop;
        const fixedHeight = document.querySelector(".sticky")?.getBoundingClientRect().height ?? 0;
        const rect = img.getBoundingClientRect();
        if (firstClick)
            return this.isScrollDown ? scrollTop + rect.top - fixedHeight : scrollTop - (window.innerHeight - rect.bottom);
        return this.isScrollDown ? scrollTop + Math.min(rect.bottom, window.innerHeight) - fixedHeight : scrollTop - Math.min(window.innerHeight - rect.top, window.innerHeight);
    },
    menuAction: (action) => {
        const scrollMax = scroller.scrollTopMax;
        const handlerMap = {
            "top": () => scroll2Pos(0, scroller),
            "bottom": () => scroll2Pos(scrollMax, scroller),
            "back": () => window.history.back()
        }
        handlerMap[action]();
        toggleButton();
    },
    replaceHTML: function (selector) {
        return ele => ele.closest(selector).innerHTML = ele.innerHTML;
    },
    truncText: function (pEle, selector, limit) {
        if (selector)
            pEle.querySelectorAll(selector).forEach(ele => ele.textContent = ele.textContent.slice(0, limit) + "…");
        else
            pEle.textContent = pEle.textContent.slice(0, limit) + "…";
    },
    replaceImg: function (tagName, src, rmSelector) {
        return img => {
            const node = createImg(img, tagName, src);
            if (rmSelector)
                img = img.closest(rmSelector) || img.parentElement;
            img.after(node);
            img.remove();
        };
    },
    createImg: function (img, tagName, src) {
        const node = document.createElement(tagName);
        if (/a/i.test(tagName)) {
            node.href = img.href;
            node.style.cssText = "text-decoration: none";
            node.textContent = img.textContent;
        } else {
            node.src = img.getAttribute(src) || img.src;
            if (/video/i.test(tagName)) {
                node.controls = true;
                let maxHeight = "360px";
                if (/\/p\/\d+/.test(document.URL))
                    maxHeight = "80vh";
                node.style.cssText += `max-height: ${maxHeight}; max-width: 100%`;
            }
        }
        return node;
    },
    iCss: function (actionMap, infiniteFlag) {
        Object.entries(actionMap).forEach(([selector, func]) => {
            const timer = setInterval(() => {
                if (document.querySelectorAll(selector).length > 0) {
                    if (typeof func == "string")
                        document.querySelectorAll(selector).forEach(new Function("ele", func));
                    else
                        document.querySelectorAll(selector).forEach(func);
                    if (!infiniteFlag)
                        clearInterval(timer);
                } else if (!infiniteFlag && Date.now() - timerMap[selector] > 10000)
                    clearInterval(timer);
            }, 1000);
            timerMap[selector] = Date.now();
        });
    },
    appendCss: function (cssText) {
        return ele => {
            const style = ele.style || ele.target.style;
            style.cssText += cssText;
        };
    },
    rmElement: function (condition) {
        if (condition && !/reddit/i.test(host))
            return ele => {
                if (eval(condition))
                    ele.remove();
            };
        return ele => ele.remove();
    },
    postLink: function (func) {
        return ele => {
            if (/visited/.test(ele.classList) && !/processed/.test(ele.classList)) {
                ele.classList.add("processed");
                func(ele);
            }
        };
    },
    html2Element: function (htmlString) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');
        return doc.body.firstElementChild;
    },
    resetPos: function () {
        scroll2Pos(0);
        this.isScrollDown = true;
        contextMenu.replaceChildren(liBottom);
    },
    toggleButton: function () {
        this.isScrollDown = !this.isScrollDown;
        this.isScrollDown ? contextMenu.replaceChildren(liBottom) : contextMenu.replaceChildren(liTop);
    },
    zoomNext: function (img) {
        const imgs = Array.from(document.querySelectorAll("img")).filter(img => img.getBoundingClientRect().height >= 150);
        const index = Number(imgs.map((item, index) => {
            item.setAttribute("data-index", index);
            return item;
        }).filter(item => item == img)[0]?.getAttribute("data-index"));
        const next = this.isScrollDown ? index + 1 : index - 1;
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

window.Utils = Utils;
