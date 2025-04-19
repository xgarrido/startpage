let feeds = [];

async function loadFeedsYaml() {
    try {
        const res = await fetch('feeds.yml');
        const text = await res.text();
        const data = jsyaml.load(text);
        feeds = data.feeds;
        renderFeeds();
    } catch (err) {
        console.error("Failed to load feeds.yml:", err);
    }
}

async function loadFeed(feedUrl, feedNbr) {
    const proxyUrl = `https://rss-proxy-xg.deno.dev/?target=${encodeURIComponent(feedUrl)}`;

    let items = [];
    try {
        const res = await fetch(proxyUrl);
        const xmlText = await res.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "application/xml");

        // Handle invalid XML
        if (xmlDoc.querySelector("parsererror")) {
            throw new Error("Invalid XML structure");
        }
        console.log(xmlDoc);
        let query = xmlDoc.querySelectorAll("item");
        if (!query.length) {
            query = xmlDoc.querySelectorAll("entry");
        }
        items = Array.from(query).map(item => {
            const getText = (tag) => item.querySelector(tag)?.textContent?.trim() || "";

            return {
                title: getText("title"),
                link: getText("link"),
                published: getText("updated") || getText("pubDate") || getText("published"),
                description: getText("description") || getText("content\\:encoded"),
                author: getText("author"),
                guid: getText("guid") || getText("id")
            };
        });
        const sortedItems = items.sort((a, b) => new Date(b.published) - new Date(a.published));
        return sortedItems.slice(0, feedNbr ?? 5);
    } catch (err) {
        console.error("Failed to load", feedUrl, err);
        return [];
    }
}

function removeImages(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    const imgs = div.querySelectorAll('img');
    imgs.forEach(img => img.remove());
    return div.innerHTML;
}

async function renderFeeds() {
    for (let i = 0; i < feeds.length; i++) {
        const column = document.getElementById(`col${i + 1}`);
        for (const feed of feeds[i]) {
            const items = await loadFeed(feed.url, feed.nbr);
            const div = document.createElement("div");
            div.className = "feed";
            div.innerHTML = `<h2><a href="${feed.link}" target="_blank">🗞️ ${feed.title}</a></h2><ul>` +
                items.map(item => {
                    let cleanDesc = "";
                    if (feed.with_desc) {
                        cleanDesc = removeImages(item.description).slice(0, 150) + "...";
                    }
                    return `
          <li>
            <a href="${item.link}" target="_blank">${item.title.slice(0, 60) + "..."}</a>
            <span class="date">🗓️${new Date(item.published).toLocaleDateString('default', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            }).replace(' ', ' ⏰')}</span><br>
            <span class="desc">${cleanDesc}</span>
          </li>`;
                }).join("") + `</ul>`;
            column.appendChild(div);
        }
    }
}

loadFeedsYaml();
