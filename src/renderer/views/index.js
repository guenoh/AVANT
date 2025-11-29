/**
 * Views Index - Export all view classes
 * Load this file after loading individual view files
 */

// Ensure all views are available globally
(function() {
    // Check that required classes exist
    const requiredClasses = [
        'BaseView',
        'ViewManager',
        'ScenarioListView',
        'ActionEditorView',
        'LeftPanelView'
    ];

    const missing = requiredClasses.filter(name => !window[name]);
    if (missing.length > 0) {
        console.warn('Missing view classes:', missing);
    }

    /**
     * Initialize the view system
     * @param {Object} options - Initialization options
     * @returns {ViewManager} Configured ViewManager instance
     */
    function initViewSystem(options = {}) {
        const eventBus = options.eventBus || window.eventBus;
        const app = options.app || window.macroApp;

        // Create ViewManager
        const viewManager = new ViewManager({ eventBus });

        // Register views
        viewManager.register('scenario-list', ScenarioListView);
        viewManager.register('action-editor', ActionEditorView);
        viewManager.register('left-panel', LeftPanelView);

        // Store globally
        window.viewManager = viewManager;

        console.log('[ViewSystem] Initialized with views:', Array.from(viewManager.views.keys()));

        return viewManager;
    }

    /**
     * Create and mount the left panel
     * @param {string} containerSelector - Container CSS selector
     * @param {Object} options - Options
     * @returns {LeftPanelView} Mounted left panel view
     */
    function mountLeftPanel(containerSelector, options = {}) {
        const container = document.querySelector(containerSelector);
        if (!container) {
            console.error(`[ViewSystem] Container not found: ${containerSelector}`);
            return null;
        }

        const leftPanel = new LeftPanelView({
            eventBus: options.eventBus || window.eventBus,
            app: options.app || window.macroApp,
            viewManager: window.viewManager
        });

        leftPanel.mount(container);

        return leftPanel;
    }

    // Export functions
    window.ViewSystem = {
        init: initViewSystem,
        mountLeftPanel: mountLeftPanel,

        // Quick access to view classes
        BaseView: window.BaseView,
        ViewManager: window.ViewManager,
        ScenarioListView: window.ScenarioListView,
        ActionEditorView: window.ActionEditorView,
        LeftPanelView: window.LeftPanelView
    };

    console.log('[ViewSystem] Module loaded');
})();
