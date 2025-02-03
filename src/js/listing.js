import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const supabase = createClient(supabaseUrl, supabaseKey);

let currentOptionsMenu = null;
let allArticles = [];

function formatDate(dateString) {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

function getImageUrl(storedImagePath) {
    if (!storedImagePath) return null;
    return `${supabaseUrl}/storage/v1/object/public/article-images/${storedImagePath}`;
}

async function loadDocuments() {
    try {
        const { data: articles, error } = await supabase
            .from('saved_articles')
            .select('*')
            .order('time_added', { ascending: false });

        if (error) throw error;

        allArticles = articles;
        renderDocuments(articles);
    } catch (error) {
        console.error('Error loading articles:', error);
        showError('Failed to load articles: ' + error.message);
    }
}

function renderDocuments(articles) {
    const container = document.getElementById('documents');
    container.innerHTML = articles.map(article => `
        <div class="document-card">
            ${article.stored_image_path ? 
                `<div class="card-image" style="background-image: url('${getImageUrl(article.stored_image_path)}')"></div>`
                : ''}
            <div class="card-content">
                <h2 class="card-title">
                    <a href="${article.url}" target="_blank">${article.title}</a>
                </h2>
                <p class="card-excerpt">${article.excerpt}</p>
                <div class="card-source">
                    <div class="source-info">
                        <span>${article.source}</span>
                        <span>•</span>
                        <span>${formatDate(article.time_added)}</span>
                    </div>
                    <button class="options-button" data-article-id="${article.id}">⋮</button>
                </div>
            </div>
        </div>
    `).join('');

    // Add event listeners to options buttons
    document.querySelectorAll('.options-button').forEach(button => {
        button.addEventListener('click', (event) => {
            showOptionsMenu(event, button.dataset.articleId);
        });
    });
}

async function deleteArticle(id) {
    try {
        const { error } = await supabase
            .from('saved_articles')
            .delete()
            .eq('id', id);

        if (error) throw error;

        // Remove from UI
        const index = allArticles.findIndex(article => article.id === id);
        if (index !== -1) {
            allArticles.splice(index, 1);
            renderDocuments(allArticles);
        }

        hideOptionsMenu();
    } catch (error) {
        console.error('Error deleting article:', error);
        showError('Failed to delete article: ' + error.message);
    }
}

function showOptionsMenu(event, articleId) {
    event.stopPropagation();
    hideOptionsMenu();

    const menu = document.getElementById('optionsMenu');
    menu.innerHTML = `
        <div class="options-menu-item delete" data-article-id="${articleId}">
            Delete
        </div>
    `;

    // Add event listener to delete option
    menu.querySelector('.delete').addEventListener('click', () => {
        deleteArticle(articleId);
    });

    const button = event.target;
    const rect = button.getBoundingClientRect();
    menu.style.top = `${rect.bottom + window.scrollY + 5}px`;
    menu.style.left = `${rect.left + window.scrollX - 100}px`;
    menu.style.display = 'block';
    currentOptionsMenu = menu;
}

function hideOptionsMenu() {
    if (currentOptionsMenu) {
        currentOptionsMenu.style.display = 'none';
    }
}

function searchDocuments(query) {
    const searchTerm = query.toLowerCase();
    const filtered = allArticles.filter(article => 
        article.title.toLowerCase().includes(searchTerm) ||
        article.excerpt.toLowerCase().includes(searchTerm) ||
        article.source.toLowerCase().includes(searchTerm)
    );
    renderDocuments(filtered);
}

function showError(message) {
    const container = document.getElementById('documents');
    container.innerHTML = `<div class="error-message">${message}</div>`;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', loadDocuments);

// Add search input event listener
document.getElementById('searchInput').addEventListener('input', (event) => {
    searchDocuments(event.target.value);
});

// Close options menu when clicking outside
document.addEventListener('click', (event) => {
    if (!event.target.closest('.options-button') && !event.target.closest('.options-menu')) {
        hideOptionsMenu();
    }
}); 