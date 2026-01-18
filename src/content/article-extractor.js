/**
 * Sonara - Content Script
 * Extracts clean article content from web pages
 */

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractArticle') {
    try {
      const extractor = new ArticleExtractor();
      const article = extractor.extractArticle();
      sendResponse({ success: true, article });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
    return true; // Keep channel open for async response
  }
});

// Note: ArticleExtractor class needs to be available
// We'll inject it or define it here
class ArticleExtractor {
  constructor() {
    this.articleSelectors = [
      'article',
      '[role="article"]',
      '.article',
      '.post',
      '.entry',
      '.content',
      '.main-content',
      '#content',
      '#main-content',
      '.story-body',
      '.article-body',
      '.post-content'
    ];

    this.removeSelectors = [
      'script',
      'style',
      'nav',
      'header',
      'footer',
      '.ad',
      '.advertisement',
      '.ads',
      '.sidebar',
      '.social-share',
      '.comments',
      '.comment-section',
      '.related-posts',
      '.newsletter',
      '[class*="ad"]',
      '[id*="ad"]'
    ];
  }

  extractArticle() {
    const doc = document.cloneNode(true);
    this.removeUnwantedElements(doc);
    
    let articleElement = this.findArticleElement(doc);
    if (!articleElement) {
      articleElement = doc.body;
    }

    const text = this.extractText(articleElement);
    const html = this.extractHTML(articleElement);
    
    return {
      text: text.trim(),
      html: html.trim(),
      title: this.extractTitle(doc),
      author: this.extractAuthor(doc),
      publishedDate: this.extractPublishedDate(doc)
    };
  }

  findArticleElement(doc) {
    for (const selector of this.articleSelectors) {
      const element = doc.querySelector(selector);
      if (element && this.isValidContent(element)) {
        return element;
      }
    }
    return null;
  }

  isValidContent(element) {
    const text = element.textContent || '';
    const wordCount = text.trim().split(/\s+/).length;
    return wordCount > 50;
  }

  removeUnwantedElements(doc) {
    this.removeSelectors.forEach(selector => {
      try {
        const elements = doc.querySelectorAll(selector);
        elements.forEach(el => el.remove());
      } catch (e) {
        // Ignore invalid selectors
      }
    });
  }

  extractText(element) {
    if (!element) return '';
    const clone = element.cloneNode(true);
    clone.querySelectorAll('script, style').forEach(el => el.remove());
    let text = clone.textContent || '';
    text = text.replace(/\s+/g, ' ');
    text = text.replace(/\n\s*\n/g, '\n\n');
    return text;
  }

  extractHTML(element) {
    if (!element) return '';
    return element.innerHTML || '';
  }

  extractTitle(doc) {
    const titleSelectors = [
      'h1',
      '.article-title',
      '.post-title',
      '.entry-title',
      '[property="og:title"]',
      'meta[name="twitter:title"]'
    ];

    for (const selector of titleSelectors) {
      const element = doc.querySelector(selector);
      if (element) {
        const title = element.textContent || element.content || element.getAttribute('content');
        if (title && title.trim()) {
          return title.trim();
        }
      }
    }

    return doc.title || '';
  }

  extractAuthor(doc) {
    const authorSelectors = [
      '[rel="author"]',
      '.author',
      '.byline',
      '[property="article:author"]',
      'meta[name="author"]'
    ];

    for (const selector of authorSelectors) {
      const element = doc.querySelector(selector);
      if (element) {
        const author = element.textContent || element.content || element.getAttribute('content');
        if (author && author.trim()) {
          return author.trim();
        }
      }
    }

    return '';
  }

  extractPublishedDate(doc) {
    const dateSelectors = [
      'time[datetime]',
      '[property="article:published_time"]',
      'meta[name="publish-date"]',
      '.published-date',
      '.post-date'
    ];

    for (const selector of dateSelectors) {
      const element = doc.querySelector(selector);
      if (element) {
        const date = element.getAttribute('datetime') || 
                    element.content || 
                    element.getAttribute('content') ||
                    element.textContent;
        if (date && date.trim()) {
          return date.trim();
        }
      }
    }

    return '';
  }
}
