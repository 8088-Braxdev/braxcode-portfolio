/* BraxCode Digitals Foundation — homepage behaviour.
   Handles the mobile navigation toggle and loads the latest projects from Supabase. */

(function () {
  'use strict';

  var SUPABASE_URL = 'https://lopjjyxeypggctwxgrjo.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_bGkDJCOyiE1srtMaxr1RRg_DAAHjxCf';
  var PROJECT_LIMIT = 6;

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

  /* ---------- Projects ---------- */

  function hideProjects() {
    var section = document.getElementById('projects');
    var navLink = document.getElementById('navProjects');
    if (section) section.hidden = true;
    if (navLink) navLink.hidden = true;
  }

  function getTagList(project) {
    var raw = project.tags;
    var list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : [];
    return list
      .map(function (tag) {
        return String(tag).trim();
      })
      .filter(function (tag) {
        return tag.length > 0;
      });
  }

  function buildProjectCard(project) {
    var card = document.createElement('li');
    card.className = 'project-card';

    if (project.image_url) {
      var media = document.createElement('div');
      media.className = 'project-media';
      var image = document.createElement('img');
      image.src = project.image_url;
      image.alt = project.title;
      image.width = 640;
      image.height = 360;
      image.loading = 'lazy';
      image.decoding = 'async';
      media.appendChild(image);
      card.appendChild(media);
    }

    var body = document.createElement('div');
    body.className = 'project-body';

    var title = document.createElement('h3');
    title.textContent = project.title;
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

    if (project.live_url) {
      var live = document.createElement('a');
      live.href = project.live_url;
      live.target = '_blank';
      live.rel = 'noopener';
      live.textContent = 'Live site';
      links.appendChild(live);
    }

    if (project.github_url) {
      var code = document.createElement('a');
      code.href = project.github_url;
      code.target = '_blank';
      code.rel = 'noopener';
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

    grid.replaceChildren.apply(grid, projects.map(buildProjectCard));
    section.hidden = false;
    if (navLink) navLink.hidden = false;
  }

  async function loadProjects() {
    var section = document.getElementById('projects');
    if (!section) return;

    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      hideProjects();
      return;
    }

    var client;
    try {
      client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    } catch (error) {
      console.error('Supabase init failed', error);
      hideProjects();
      return;
    }

    var rows;
    try {
      var response = await client
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(PROJECT_LIMIT);
      if (response.error) throw response.error;
      rows = response.data;
    } catch (error) {
      console.error('Project fetch failed', error);
      hideProjects();
      return;
    }

    var projects = (rows || []).filter(function (project) {
      return project && project.title;
    });

    if (projects.length === 0) {
      hideProjects();
      return;
    }

    renderProjects(projects);
  }

  /* ---------- Start ---------- */

  initNavigation();
  loadProjects();
})();
