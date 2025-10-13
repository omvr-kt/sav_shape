// Global debug bootstrap: enable logs if ?debug=1 or localStorage.DEBUG=true
(function(){
  try {
    var params = new URLSearchParams(window.location.search);
    var debugParam = params.get('debug');
    var ls = window.localStorage || { getItem:function(){}, setItem:function(){} };
    var enableDebug = false;

    if (debugParam === '1' || debugParam === 'true') {
      enableDebug = true;
      try { ls.setItem('DEBUG', 'true'); } catch(e){}
    } else {
      var stored = (ls.getItem('DEBUG') || '').toString().toLowerCase();
      enableDebug = (stored === '1' || stored === 'true');
    }

    if (!enableDebug) {
      // Silence all console output
      var noop = function(){};
      var c = window.console = window.console || {};
      c.log = noop; c.warn = noop; c.error = noop; c.info = noop; c.debug = noop; c.trace = noop; c.table = noop;

      // Suppress default browser error/rejection logs
      window.addEventListener('error', function(e){ try{ e.preventDefault(); }catch(_){} return true; }, true);
      window.addEventListener('unhandledrejection', function(e){ try{ e.preventDefault(); }catch(_){} return true; });
      window.DEBUG = false;
    } else {
      window.DEBUG = true;
    }
  } catch (e) {
    // In case of any failure, do nothing
  }
})();
