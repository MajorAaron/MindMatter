export function generateSummaryHTML(articles, options = {}) {
    const {
        isEmail = false, // Default to false, override to true for email
        timeframe = 'daily' // daily, weekly, etc.
    } = options;

    // Common styles that work in both email clients and web
    const styles = `
        .summary-container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .header {
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 1px solid #eee;
        }
        .article {
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 1px solid #eee;
        }
        .article-title {
            color: #1a1a1a;
            font-size: 18px;
            font-weight: 600;
            margin: 0 0 10px 0;
            line-height: 1.4;
        }
        .article-title a {
            color: #1a1a1a;
            text-decoration: none;
        }
        .article-title a:hover {
            text-decoration: underline;
        }
        .article-excerpt {
            color: #666;
            font-size: 14px;
            line-height: 1.5;
            margin: 0 0 15px 0;
        }
        .article-meta {
            color: #666;
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .article-source {
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }
        .source-icon {
            width: 16px;
            height: 16px;
            border-radius: 3px;
            vertical-align: middle;
        }
        .article-image {
            width: 100%;
            height: 200px;
            object-fit: cover;
            margin-bottom: 15px;
            border-radius: 8px;
        }
        ${isEmail ? `
            /* Email-specific styles */
            img {
                max-width: 100%;
                height: auto;
            }
            .article-meta {
                flex-wrap: wrap;
            }
        ` : `
            /* Web-specific styles */
            .summary-container {
                background: white;
                border-radius: 8px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            }
            .article-title a:hover {
                color: #0066cc;
            }
        `}
    `;

    const formatDate = (timestamp) => {
        if (!timestamp) return '';
        const date = new Date(timestamp * 1000);
        return date.toLocaleDateString('en-US', {
            timeZone: 'America/Denver',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    const getSourceInfo = (url) => {
        try {
            const urlObj = new URL(url);
            const domain = urlObj.hostname.replace('www.', '');
            return {
                domain,
                icon: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
            };
        } catch {
            return {
                domain: 'Unknown Source',
                icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>📄</text></svg>'
            };
        }
    };

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Your ${timeframe.charAt(0).toUpperCase() + timeframe.slice(1)} Summary</title>
            <style>${styles}</style>
        </head>
        <body style="margin: 0; padding: 20px 0; background-color: ${isEmail ? '#ffffff' : '#f8f9fa'};">
            <div class="summary-container">
                <div class="header">
                    <h1 style="margin: 0; font-size: 24px; color: #1a1a1a;">
                        Your ${timeframe.charAt(0).toUpperCase() + timeframe.slice(1)} Summary
                    </h1>
                    <p style="margin: 10px 0 0 0; color: #666;">
                        Here are your saved articles from ${formatDate(articles[0]?.timeAdded)}
                    </p>
                </div>

                ${articles.map(article => {
                    const source = getSourceInfo(article.url);
                    return `
                        <div class="article">
                            ${article.topImage ? `
                                <img src="${article.topImage}" 
                                     alt="${article.title}"
                                     class="article-image">
                            ` : ''}
                            <h2 class="article-title">
                                <a href="${article.url}" target="_blank" rel="noopener noreferrer">
                                    ${article.title || 'Untitled'}
                                </a>
                            </h2>
                            <p class="article-excerpt">
                                ${article.excerpt || 'No excerpt available'}
                            </p>
                            <div class="article-meta">
                                <span class="article-source">
                                    <img class="source-icon" src="${source.icon}" alt="${source.domain}">
                                    ${source.domain}
                                </span>
                                <span>•</span>
                                <span>${formatDate(article.timeAdded)}</span>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </body>
        </html>
    `;
} 