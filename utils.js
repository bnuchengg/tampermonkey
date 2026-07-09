const ss = {
    set(key, value) {
        if (typeof value == "object")
            value = JSON.stringify(value);
        localStorage.setItem(key, value);
    },
    hashSet(key, field, value) {
        const map = this.getJson(key);
        if (value)
            map[field] = value;
        else
            delete map[field];
        this.set(key, map);
    },
    hashRemove(key, field) {
        this.hashSet(key, field, null);
    },
    hashGet(key, field) {
        return this.getJson(key)[field];
    },
    add(arr, item) {
        const _arr = this.getArray(arr);
        while (_arr.length >= 256)
            _arr.splice(0, 1);
        if (!_arr.includes(item))
            _arr.push(item);
        this.set(arr, _arr);
    },
    arrayRemove(arr, item) {
        let _arr = this.getArray(arr);
        _arr = _arr.filter(item => item != item);
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
}

class Scheduler {
    constructor(cnt) {
        this.waitingList = [];
        this.destMap = {};
        this.maxRunning = cnt;
        this.loadingNum = 0;
    }

    append(link, selector) {
        this.remove(link);
        this.destMap[link] = selector;
        this.waitingList.push(link);
    }

    prepend(link, selector) {
        this.remove(link);
        this.destMap[link] = selector;
        this.waitingList.unshift(link);
    }

    remove(link) {
        const index = this.waitingList.indexOf(link);
        if (index > -1)
            this.waitingList.splice(index, 1);
    }
}

const Utils = {
    isScrollDown: true,
    iframeCnt: 0,
    observer: new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting && !entry.target.paused && entry.target.controls)
                entry.target.pause();
        });
    }, {threshold: 0.5}),
    init: function () {
        const meta = document.createElement('meta');
        meta.name = 'viewport';
        meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
        document.head.appendChild(meta);

        window.timerMap = {};
        window.pageCache = {};

        if (!/^x.com|google.com|youtube.com/i.test(host))
            iCss({"img,video": img => img.onclick = moveImg}, true);

        window.contextMenu = document.createElement('ul');
        contextMenu.draggable = true;
        contextMenu.ondragend = (event) => contextMenu.style.cssText += `left: ${event.clientX < window.innerWidth / 2 ? 5 : 90}vw; top: ${event.clientY}px`;
        contextMenu.ontouchmove = (event) => {
            event.preventDefault();
            contextMenu.style.cssText += `left: ${event.touches[0].clientX < window.innerWidth / 2 ? 5 : 90}vw; top: ${event.touches[0].clientY}px`;
        };
        window.liBottom = createNode("li", "text-align: center; cursor: pointer", "bottom");
        window.liTop = createNode("li", "text-align: center; cursor: pointer", "top");
        contextMenu.appendChild(liBottom);
        contextMenu.style.cssText = `left: 5vw; top: 64vh; position: fixed; scale: 2.5; opacity: 0.3; list-style: none; padding: 0`;
        if (window.self == window.top)
            document.body.append(contextMenu);

        window.scheduler = new Scheduler(3);
        window.unreadCnt = 0;
        setInterval((function exec() {
            while (scheduler.waitingList?.length > 0 && scheduler.loadingNum < scheduler.maxRunning && (unreadCnt + scheduler.loadingNum) < 5) {
                scheduler.loadingNum++;
                const link = scheduler.waitingList.shift();
                const selector = scheduler.destMap[link];
                delete scheduler.destMap[link];
                loadContent(link, selector, postFuncMap[host]);
            }
            return exec;
        })(), 1000);
    },
    lazyLoad: function (ele, target, func) {
        const href = this.truncHref(ele.href);
        if (pageCache[href]) {
            func(ele);
            return;
        }
        scheduler.prepend(ele, target);
        const timer = setInterval(() => {
            if (pageCache[href]) {
                func(ele);
                clearInterval(timer);
            }
        }, 1000);
    },
    mergeLink: function (div) {
        if (div.querySelectorAll("a").length > 1) {
            const img = div.querySelector("a img");
            const parent = div == img.closest("div") ? img.closest("a") : img.closest("div");
            div.prepend(img);
            parent?.remove();
            img.addEventListener("click", (e) => div.querySelector("a").click());
        }
        return div;
    },
    convert2Link: function (ele) {
        const reactKey = Object.keys(ele).filter(key => /__reactFiber/.test(key))[0];
        let ret = ele[reactKey].return;
        while (!ret.key) {
            ret = ret.return;
        }
        const link = document.createElement("a");
        link.href = `/detail/${ret.key}`;
        link.textContent = ele.textContent;
        return link;
    },
    loadContent: function (link, selector, func) {
        const href = this.truncHref(link.href);
        if (pageCache[href]) {
            scheduler.loadingNum--;
            return;
        }
        link.classList.add("loading");
        const iframe = document.createElement("iframe");
        let timeout = 1000;
        iframe.style.cssText = "width: 100%; height: 1px; border: none";
        if (/club.kdslife|news.zhibo8.com/.test(host))
            timeout = 3500;
        iframe.src = href;
        iframe.setAttribute('sandbox', 'allow-same-origin');
        if (/kdslife.com|news.zhibo8.com/.test(host))
            iframe.sandbox.add('allow-scripts');
        iframe.onload = (e) => {
            const iframe = e.target;
            if (func)
                eval(func);
            setTimeout(() => {
                let html = iframe.contentDocument?.querySelector(selector)?.outerHTML ?? '';
                scheduler.loadingNum--;
                link.classList.remove("loading");
                if (link.getAttribute("cloneLink"))
                    html = link.cloneNode(true).outerHTML + html;
                pageCache[href] = html;
                unreadCnt++;
                iframe.remove();
            }, timeout);
        };
        document.body.append(iframe);
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
            const link = ele.href ? this.truncHref(ele.href) : ele.textContent;
            if (!/visited/.test(ele.classList)) {
                if (ss.contains(arr, link))
                    ele.classList.add("visited");
                else if (!ele.onclick)
                    ele.onclick = () => ss.add(arr, link);
            }
        };
    },
    postLink: function (func) {
        return ele => {
            if (/visited/.test(ele.classList) && !/postLink/.test(ele.classList)) {
                ele.classList.add("postLink");
                func(ele);
            }
        };
    },
    createNode: function (tagName, cssText, action) {
        const map = {"top": "⏫", "bottom": "⏬"};
        const node = document.createElement(tagName);
        node.textContent = map[action];
        node.style.cssText = `${cssText}`;
        node.onclick = () => menuAction(action);
        return node;
    },
    hideTweet: function (ele) {
        const content = ele.closest("article");
        if (!/processed/.test(ele.classList)) {
            ele.classList.add("processed");
            if (!content.getBoundingClientRect().height)
                return;
            const button = document.createElement("button");
            button.textContent = "显示";
            button.onclick = () => {
                content.style.cssText += "display: flex";
                button.remove();
            };
            content.before(button);
            content.style.cssText += "display: none";
        }
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
    truncHref: function (href) {
        const url = new URL(href);
        return url.pathname + url.hash + url.search;
    },
    truncText: function (pEle, selector, limit) {
        if (selector)
            pEle.querySelectorAll(selector).forEach(ele => ele.textContent = ele.textContent.replace(/\s/g, '').slice(0, limit) + "…");
        else
            pEle.textContent = pEle.textContent.replace(/\s/g, '').slice(0, limit) + "…";
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
                node.muted = true;
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
                if (document.querySelectorAll(selector).length > 0) {
                    try {
                        document.querySelectorAll(selector).forEach(typeof func == "string" ? new Function("ele", func) : func);
                    } catch (e) {
                        console.error(e);
                    }
                    if (!infiniteFlag)
                        return;
                }
                const timer = setInterval(() => {
                    if (document.querySelectorAll(selector).length > 0) {
                        try {
                            document.querySelectorAll(selector).forEach(typeof func == "string" ? new Function("ele", func) : func);
                        } catch (e) {
                            console.error(e);
                        }
                        if (!infiniteFlag)
                            clearInterval(timer);
                    } else if (!infiniteFlag && Date.now() - timerMap[selector] > 6e4)
                        clearInterval(timer);
                }, 1000);
                timerMap[selector] = Date.now();
            }
        );
    },
    appendCss: function (cssText) {
        return ele => {
            const style = ele.style || ele.target.style;
            style.cssText += cssText;
        };
    },
    rmElement: function (condition) {
        if (condition)
            return ele => {
                if (!/reddit/i.test(host) && eval(condition))
                    ele.remove();
            };
        return ele => ele.remove();
    },
    html2Element: function (htmlString) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');
        return doc.body.firstElementChild;
    },
    resetPos: function () {
        scroll2Pos(0);
        scroll2HPos(document.querySelector(".sticky"), 0);
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
    isTouchScreen: () => navigator.maxTouchPoints > 0,
    scroll2Pos: function (pos) {
        scroller.scrollTo({
            top: pos,
            behavior: 'smooth'
        });
    },
    scroll2HPos: function (container, pos) {
        container.scrollTo({
            left: pos,
            behavior: 'smooth'
        });
    }
};

window.Scheduler = Scheduler;
window.ss = ss;
Object.keys(Utils).forEach(key => window[key] = Utils[key]);
