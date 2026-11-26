/* BraxCode Digitals Foundation - homepage behaviour.
   Handles mobile navigation, active section highlighting, and loads live projects from Supabase. */

(function () {
  'use strict';

  var SUPABASE_URL = 'https://lopjjyxeypggctwxgrjo.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_bGkDJCOyiE1srtMaxr1RRg_DAAHjxCf';
  var PROJECT_LIMIT = 6;
  var FETCH_LIMIT = 12;
  var CACHE_KEY = 'brx_projects_v1';
  var CACHE_TTL = 10 * 60 * 1000;

  /* ---------- Mobile navigation ---------- */

  function setMenuState(isOpen) {
    var toggle = document.querySelector('.nav-toggle');
    var nav = document.getElementById('site-nav');
    if (!toggle || !nav) return;

    nav.classList.toggle('open', isOpen);
    toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    toggle.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
  }

  function initNavigation() {
    var toggle = document.querySelector('.nav-toggle');
    var nav = document.getElementById('site-nav');
    if (!toggle || !nav) return;

    toggle.addEventListener('click', function () {
      setMenuState(!nav.classList.contains('open'));
    });

    nav.addEventListener('click', function (event) {
      if (event.target.closest('a')) setMenuState(false);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') setMenuState(false);
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth >= 900) setMenuState(false);
    });
  }

  /* ---------- Active section highlighting ---------- */

  function initActiveNav() {
    var navLinks = document.querySelectorAll('.site-nav a[href^="#"]');
    if (!navLinks.length) return;

    var sectionIds = ['services', 'projects', 'pricing', 'about', 'contact'];
    var sections = sectionIds
      .map(function (id) { return document.getElementById(id); })
      .filter(function (section) {
        return section && !section.hidden;
      });

    if (!sections.length) return;

    if (window.__brxActiveNavObserver) {
      window.__brxActiveNavObserver.disconnect();
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var id = '#' + entry.target.id;
        navLinks.forEach(function (link) {
          if (link.getAttribute('href') === id) {
            link.setAttribute('aria-current', 'location');
            link.classList.add('is-active');
          } else {
            link.removeAttribute('aria-current');
            link.classList.remove('is-active');
          }
        });
      });
    }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });

    sections.forEach(function (section) {
      observer.observe(section);
    });
    window.__brxActiveNavObserver = observer;
  }

  /* ---------- Projects ---------- */

  function hideProjects() {
    var section = document.getElementById('projects');
    var navLink = document.getElementById('navProjects');
    var grid = document.getElementById('projectGrid');
    if (section) section.hidden = true;
    if (navLink) navLink.hidden = true;
    if (grid) grid.setAttribute('aria-busy', 'false');
  }

  function getTagList(project) {
    var raw = project && project.tags;
    var list = Array.isArray(raw) ? raw : (typeof raw === 'string' ? raw.split(',') : []);
    return list
      .map(function (tag) { return String(tag).trim(); })
      .filter(function (tag) { return tag.length > 0; });
  }

  function buildProjectCard(project) {
    var card = document.createElement('li');
    card.className = 'project-card';

    if (project.image_url) {
      var media = document.createElement('div');
      media.className = 'project-media';
      var image = document.createElement('img');
      image.src = project.image_url;
      image.alt = project.title || '';
      image.width = 640;
      image.height = 360;
      image.loading = 'lazy';
      image.decoding = 'async';
      image.onerror = function () {
        var placeholder = document.createElement('div');
        placeholder.className = 'project-media-placeholder';
        placeholder.textContent = 'No image';
        if (media.parentNode) media.replaceChild(placeholder, image);
      };
      media.appendChild(image);
      card.appendChild(media);
    } else {
      var emptyMedia = document.createElement('div');
      emptyMedia.className = 'project-media';
      var placeholder = document.createElement('div');
      placeholder.className = 'project-media-placeholder';
      placeholder.textContent = 'No image';
      emptyMedia.appendChild(placeholder);
      card.appendChild(emptyMedia);
    }

    var body = document.createElement('div');
    body.className = 'project-body';

    var title = document.createElement('h3');
    title.textContent = project.title || '';
    body.appendChild(title);

    if (project.description) {
      var description = document.createElement('p');
      description.className = 'project-desc';
      description.textContent = project.description;
      body.appendChild(description);
    }

    var tags = getTagList(project);
    if (tags.length > 0) {
      var tagList = document.createElement('ul');
      tagList.className = 'project-tags';
      tags.forEach(function (tag) {
        var item = document.createElement('li');
        item.textContent = tag;
        tagList.appendChild(item);
      });
      body.appendChild(tagList);
    }

    var links = document.createElement('div');
    links.className = 'project-links';

    if (project.live_url && String(project.live_url).trim() !== '') {
      var live = document.createElement('a');
      live.href = String(project.live_url).trim();
      live.target = '_blank';
      live.rel = 'noopener noreferrer';
      live.textContent = 'Live site';
      links.appendChild(live);
    }

    if (project.github_url) {
      var code = document.createElement('a');
      code.href = project.github_url;
      code.target = '_blank';
      code.rel = 'noopener noreferrer';
      code.textContent = 'Code';
      links.appendChild(code);
    }

    if (links.childElementCount > 0) body.appendChild(links);
    card.appendChild(body);
    return card;
  }

  function renderProjects(projects) {
    var section = document.getElementById('projects');
    var grid = document.getElementById('projectGrid');
    var navLink = document.getElementById('navProjects');
    if (!section || !grid) return;

    grid.replaceChildren();
    projects.forEach(function (project) {
      grid.appendChild(buildProjectCard(project));
    });
    section.hidden = false;
    if (navLink) navLink.hidden = false;
    grid.setAttribute('aria-busy', 'false');
    initActiveNav();
  }

  function readCache() {
    try {
      var raw = window.sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.data) || typeof parsed.ts !== 'number') return null;
      if (Date.now() - parsed.ts > CACHE_TTL) return null;
      return parsed;
    } catch (error) {
      return null;
    }
  }

  function writeCache(data) {
    try {
      window.sessionStorage.setItem(CACHE_KEY, JSON.stringify({ v: 1, data: data, ts: Date.now() }));
    } catch (error) {
      /* storage unavailable */
    }
  }

  function isLive(project) {
    return !!project && typeof project.live_url === 'string' && project.live_url.trim() !== '';
  }

  async function loadProjects() {
    var section = document.getElementById('projects');
    var grid = document.getElementById('projectGrid');
    if (!section || !grid) return;

    var cached = readCache();
    if (cached && cached.data.length > 0) {
      renderProjects(cached.data);
    }

    var controller = new AbortController();
    var timeoutId = setTimeout(function () { controller.abort(); }, 8000);

    try {
      var url = SUPABASE_URL + '/rest/v1/projects?select=title,description,tags,image_url,live_url,github_url,created_at&live_url=not.is.null&order=created_at.desc&limit=' + FETCH_LIMIT;
      var response = await fetch(url, {
        method: 'GET',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: 'Bearer ' + SUPABASE_KEY,
          Accept: 'application/json'
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error('Project fetch failed');
      var rows = await response.json();
      if (!Array.isArray(rows)) throw new Error('Invalid project data');

      var projects = rows.filter(isLive).slice(0, PROJECT_LIMIT);

      if (projects.length === 0) {
        if (!cached) hideProjects();
        return;
      }

      var changed = !cached || JSON.stringify(cached.data) !== JSON.stringify(projects);
      if (changed || !cached) {
        renderProjects(projects);
      }
      writeCache(projects);
    } catch (error) {
      console.error('Project fetch failed', error);
      if (!cached) hideProjects();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /* ---------- Start ---------- */

  initNavigation();
  initActiveNav();
  loadProjects();
})();