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
    hashRm(key, field) {
        this.hashSet(key, field, null);
    },
    hashGet(key, field) {
        return this.getJson(key)[field];
    },
    add(arr, item) {
        const _arr = this.getArray(arr);
        if(_arr.length >= 1024)
            _arr.splice(0, 256);
        if (!_arr.includes(item))
            _arr.push(item);
        this.set(arr, _arr);
    },
    arrayRm(arr, item) {
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
    constructor(maxRunning,maxCache) {
        this.waitingList = [];
        this.destMap = {};
        this.maxRunning = maxRunning;
        this.maxCache = maxCache;
        this.loadingNum = 0;
        this.cacheNum = 0;
    }

    insert(link, selector, pos){
        if(this.waitingList.filter(e => e!= link && e.href == link.href).length > 0)
        {
            link.remove();
            return;
        }
        this.remove(link);
        this.destMap[link] = selector;
        if(pos != 0)
            this.waitingList.push(link);
        else
            this.waitingList.unshift(link);
    }

    append(link, selector) {
        this.insert(link, selector);
    }

    prepend(link, selector) {
        this.insert(link, selector, 0);
    }

    remove(link) {
        const index = this.waitingList.indexOf(link);
        if (index > -1)
            this.waitingList.splice(index, 1);
    }

    loading(link){
        this.remove(link);
        this.loadingNum++;
        link.classList.add("loading");
    }

    loaded(link){
        this.loadingNum--;
        link.classList.remove("loading");
    }

    addCache(link, html){
        pageCache[link.href] = html;
        link.classList.add("cached");
        this.cacheNum++;
    }

    rmCache(link){
        link.classList.remove("cached");
        delete pageCache[link.href];
        this.cacheNum--;
    }

    run(){
        while (this.waitingList?.length > 0 && this.loadingNum < this.maxRunning && (this.cacheNum + this.loadingNum) < this.maxCache) {
            const link = this.waitingList.shift();
            const selector = this.destMap[link];
            delete this.destMap[link];
            loadContent(link, selector, postFuncMap[host]);
        }
    }
}

const Utils = {
    isScrollDown: true,
    iframeCnt: 0,
    lastDelTime: 0,
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
        window.pageCache = {};

        if (!/^x.com|google.com|youtube.com/i.test(host))
            iCss({"img,video": img => img.onclick = moveImg}, true);
        autoScroll();

        window.contextMenu = document.createElement('ul');
        contextMenu.draggable = true;
        contextMenu.ondragend = (event) => contextMenu.style.cssText += `top: ${event.clientY}px`;
        contextMenu.ontouchmove = (event) => {
            event.preventDefault();
            contextMenu.style.cssText += `top: ${event.touches[0].clientY}px`;
        };
        const liCssText = "text-align: center; cursor: pointer; font-size: 42px !important";
        window.liBottom = createNode("li", liCssText, "bottom");
        window.liTop = createNode("li", liCssText, "top");
        window.liRefresh = createNode("li", liCssText, "refresh");
        liRefresh.style.cssText += "font-size: 36px !important";
        contextMenu.appendChild(liBottom);
        contextMenu.appendChild(liRefresh);
        contextMenu.classList.add("contextmenu");
        document.body.append(contextMenu);

        let lastShowtime = 0;
        window.onscroll = () => {
            lastShowtime = Date.now();
            show(contextMenu, "flex");
            lazyExec(() => {
                if(Date.now() - lastShowtime > 2950)
                    hide(contextMenu);
            }, 3000);
        };

        window.scheduler = new Scheduler(3,5);
        loopExec((function exec() {
            scheduler.run();
            return exec;
        })());
    },
    emptyFunc: () => {},
    show: (ele, type = '') => ele.style.display = type,
    hide: (ele) => ele.style.display = 'none',
    lazyLoad: function (ele, target, func) {
        const href = ele.href;
        if (pageCache[href]){
            func(ele);
            return;
        }
        loadContent(ele, target, postFuncMap[host]);
        const timer = loopExec(() => {
            if (pageCache[href]){
                func(ele);
                clearInterval(timer);
            }
        });
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
        return createLink(`/detail/${ret.key}`, ele.textContent);
    },
    loadContent: function (link, selector, func) {
        const href = link.href;
        if (pageCache[href]){
            return;
        }
        if(/loading/.test(link.classList))
            return;
        scheduler.loading(link);
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
            clearTimeout(timer);
            postLoaded();
        };
        document.body.append(iframe);
        const timer = lazyExec(() => {
            console.log(`${iframe.src} load overtime...`)
            iframe.onload = null;
            postLoaded();
        }, 5000);
        function postLoaded(){
            if (func)
                eval(func);
            lazyExec(() => {
                scheduler.loaded(link);
                let html = iframe.contentDocument?.querySelector(selector)?.outerHTML ?? '';
                if(/player.bilibili.com/i.test(html))
                    link.remove();
                else {
                    link.getAttribute("cloneLink") ? decorate() : null;
                    scheduler.addCache(link, html);
                }
                iframe.remove();
                function decorate(){
                    const a = link.cloneNode(true);
                    a.textContent = link.title;
                    a.classList.add("title");
                    html = a.outerHTML + html;
                }
            }, timeout);
        }
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
    visitLink: function (ele, func) {
        const arr = "vLinks";
        const link = ele.href ? ele.href : ele.textContent;
        if (ss.contains(arr, link)){
            ele.classList.add("visited");
            if(func){
                const timer = loopExec(() => {
                    if (!/loading/.test(ele.classList)) {
                        clearInterval(timer);
                        func(ele);
                    }
                });
            }
            return true;
        } else
            ele.onclick = () => {
                ss.add(arr, link);
                visitLink(ele, func);
            }
    },
    createNode: function (tagName, cssText, action) {
        const map = {"top": "⏫", "bottom": "⏬", "refresh": "🔄️"};
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
        let firstClick = false;
        if (!img.classList.contains("zoomed")) {
            img.classList.add("zoomed");
            firstClick = true;
        } else
            zoomNext(img);
        lazyExec(scroll2Pos,150, { top: calcScrollPos(img, firstClick) });
    },
    calcScrollPos: function (img, firstClick) {
        const scrollTop = scroller.scrollTop;
        const fixedHeight = document.querySelector(".stickynav")?.getBoundingClientRect().height ?? 0;
        const rect = img.getBoundingClientRect();
        if (firstClick || rect.bottom <= 0 || rect.top >= window.innerHeight)
            return this.isScrollDown ? scrollTop + rect.top - fixedHeight : scrollTop - (window.innerHeight - rect.bottom);
        return this.isScrollDown ? scrollTop + Math.min(rect.bottom, window.innerHeight) - fixedHeight : scrollTop - Math.min(window.innerHeight - rect.top, window.innerHeight);
    },
    menuAction: (action) => {
        const handlerMap = {
            "top": () => scroll2Pos({ top: 0 }),
            "bottom": () => scroll2Pos({ top: scroller.scrollTopMax }),
            "refresh": () => {
                if(confirm("Refresh the page ?"))
                    window.location.reload();
                scroll2Pos({ top: 0 });
            },
            "back": () => window.history.back()
        }
        handlerMap[action]();
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
            iExec(selector, ele => ele.textContent = ele.textContent.replace(/\s/g, '').slice(0, limit) + "…", pEle);
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
        if (/a/i.test(tagName))
            return createLink(img.href, img.textContent, "text-decoration: none");
        else {
            const node = document.createElement(tagName);
            node.src = img.getAttribute(src) || img.src;
            if (/video/i.test(tagName)) {
                node.controls = true;
                node.muted = true;
                let maxHeight = "360px";
                if (/\/p\/\d+/.test(document.URL))
                    maxHeight = "80vh";
                node.style.cssText += `max-height: ${maxHeight}; max-width: 100%`;
            }
            return node;
        }
    },
    createLink: function(href, text, cssText) {
        const link = document.createElement("a");
        link.href = href;
        link.textContent = text;
        if(cssText)
            link.style.cssText = cssText;
        return link;
    },
    createTxt: function(text,cssText) {
        const node = document.createElement("span");
        node.textContent = text;
        if(cssText)
            node.style.cssText = cssText;
        return node;
    },
    iCss: function (actionMap, infiniteFlag) {
        Object.entries(actionMap).forEach(([selector, func]) => {
                if (document.querySelectorAll(selector).length > 0) {
                    try {
                        iExec(selector, func);
                    } catch (e) {
                        console.error(e);
                    }
                    if (!infiniteFlag)
                        return;
                }
                const timer = loopExec(() => {
                    if (document.querySelectorAll(selector).length > 0) {
                        try {
                            iExec(selector, func);
                        } catch (e) {
                            console.error(e);
                        }
                        if (!infiniteFlag)
                            clearInterval(timer);
                    }
                });
            }
        );
    },
    iExec: function(selector, func, parent) {
        (parent ?? document).querySelectorAll(selector).forEach(typeof func == "string" ? new Function("ele", func) : func);
    },
    appendCss: function (cssText) {
        return ele => {
            const style = ele.style || ele.target.style;
            style.cssText += cssText;
        };
    },
    rmElement: function (condition) {
        return ele => {
            if (!condition || !/reddit|^x.com/i.test(host) && eval(condition))
                ele?.remove();
        };
    },
    rmElements: function (arr, func) {
        const timer = loopExec(() => {
            if(Date.now() - this.lastDelTime >= 500){
                this.lastDelTime = Date.now();
                clearInterval(timer)
                if(func)
                    func();
                arr.forEach(ele => ele?.remove());
            }}, 100);
    },
    sleep : function(ms){
        return new Promise(r => setTimeout(r, ms));
    },
    casLastTime: function (oldValue){
        if(this.lastDelTime == oldValue){
            this.lastDelTime = Date.now();
            return true;
        }
        return false;
    },
    html2Element: function (htmlString) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');
        return doc.body.firstElementChild;
    },
    resetPos: function () {
        scroll2Pos({ top: 0 });
        scroll2Pos({ left : 0 },document.querySelector(".stickynav"));
    },
    toggleButton: function () {
        this.isScrollDown = !this.isScrollDown;
        this.isScrollDown ? contextMenu.replaceChild(liBottom, liTop) : contextMenu.replaceChild(liTop, liBottom);
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
    lazyExec: function(func, timeout = 1000, ...args) {
        return setTimeout(func, timeout, ...args);
    },
    loopExec: function(func, timeout = 1000, ...args) {
        return setInterval(func, timeout, ...args);
    },
    autoScroll: function() {
        lazyExec(() => {
            const imgs = Array.from(document.querySelectorAll("img")).filter(img => img.getBoundingClientRect().height >= 150);
            if(imgs.length > 10 && confirm(`Auto scroll ${imgs.length} images?`)){
                let index = 0;
                this.isScrollDown = true;
                const timer = loopExec(() => {
                    imgs[index++].click();
                    if(index == imgs.length){
                        clearInterval(timer);
                        lazyExec(resetPos);
                    }
                });
            }
        }, 3000);
    },
    isTouchScreen: () => navigator.maxTouchPoints > 0,
    scroll2Pos: function (option, container) {
        option.behavior = "smooth";
        (container ?? scroller).scrollTo(option);
    }
};

window.Scheduler = Scheduler;
window.ss = ss;
Object.keys(Utils).forEach(key => window[key] = Utils[key]);
