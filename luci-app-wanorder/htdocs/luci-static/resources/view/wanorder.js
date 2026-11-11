'use strict';
'require view';
'require fs';
'require ui';

var CMD = '/usr/bin/wan-order';

function parse(out) {
	return (out || '').trim().split('\n').filter(Boolean).map(function(l) {
		var f = l.trim().split(/\s+/);
		return {
			name: f[0], dev: f[1], up: f[2] === 'true',
			metric: parseInt(f[3], 10), enabled: f[4] !== '0',
			ip: f[5], active: f[6] === 'yes'
		};
	}).sort(function(a, b) { return a.metric - b.metric; });
}

function parseCands(out) {
	return (out || '').trim().split('\n').filter(Boolean).map(function(l) {
		var f = l.trim().split(/\s+/);
		return { name: f[0], proto: f[1] || '' };
	});
}

function parseWd(out) {
	var f = (out || '').trim().split(/\s+/);
	return { enabled: f[0] === 'enabled', running: f[1] === 'running', secs: f[2] || '300' };
}

function btn(label, cls, fn, disabled) {
	var attrs = { 'class': 'cbi-button ' + cls, 'click': fn, 'style': 'margin-right:.3em' };
	if (disabled) attrs.disabled = 'disabled';
	return E('button', attrs, label);
}

function fetchAll() {
	return Promise.all([
		fs.exec_direct(CMD, ['status']).catch(function() { return ''; }),
		fs.exec_direct(CMD, ['candidates']).catch(function() { return ''; }),
		fs.exec_direct(CMD, ['watchdog', 'status']).catch(function() { return ''; })
	]);
}

return view.extend({
	load: function() {
		return fetchAll();
	},

	render: function(data) {
		var list = parse(data[0]);
		var cands = parseCands(data[1]);
		var wd = parseWd(data[2]);
		var tbody = E('tbody');
		var warn = E('div');
		var addBox = E('div', { 'class': 'cbi-section' });
		var wdBox = E('div', { 'class': 'cbi-section' });
		var minutes = E('input', { type: 'number', min: '0', value: '0', style: 'width:6em' });

		function refresh() {
			return fetchAll().then(function(d) {
				list = parse(d[0]);
				cands = parseCands(d[1]);
				wd = parseWd(d[2]);
				draw();
			});
		}

		function run(args) {
			ui.showModal(null, [ E('p', { 'class': 'spinning' }, _('Applying...')) ]);
			return fs.exec_direct(CMD, args)
				.then(refresh)
				.catch(function(e) {
					ui.addNotification(null, E('p', e.message), 'danger');
					return refresh();
				})
				.finally(function() { ui.hideModal(); });
		}

		function reorder(arr) {
			var m = parseInt(minutes.value, 10);
			return run(m > 0 ? ['set', '--revert', String(m)].concat(arr) : ['set'].concat(arr));
		}

		function confirmRemove(r) {
			var chk = E('input', { type: 'checkbox' });
			ui.showModal(_('Remove %s').format(r.name), [
				E('p', _('%s will no longer be managed in the WAN order. The interface itself is not deleted from the network configuration.').format(r.name)),
				E('p', [ chk, ' ', _('Also bring the interface down (disable it)') ]),
				E('div', { 'class': 'right' }, [
					E('button', { 'class': 'btn', 'click': function() { ui.hideModal(); } }, _('Cancel')),
					' ',
					E('button', {
						'class': 'btn cbi-button-negative',
						'click': function() {
							ui.hideModal();
							run(chk.checked ? ['remove', r.name, 'down'] : ['remove', r.name]);
						}
					}, _('Remove'))
				])
			]);
		}

		function drawWd() {
			while (wdBox.firstChild) wdBox.removeChild(wdBox.firstChild);
			wdBox.appendChild(E('h3', _('Automatic failover (watchdog)')));

			var status;
			if (!wd.enabled)
				status = E('strong', { 'style': 'color:#999' }, _('Disabled'));
			else if (wd.running)
				status = E('strong', { 'style': 'color:#2e9d4f' }, _('Enabled and running'));
			else
				status = E('strong', { 'style': 'color:#cc3d3d' }, _('Enabled but not running'));

			wdBox.appendChild(E('p', [ _('Status:'), ' ', status ]));
			wdBox.appendChild(E('p', { 'style': 'color:#999' },
				_('If the primary WAN has no internet for %s seconds, the next working WAN is promoted to primary. Watching needs at least two enabled interfaces.').format(wd.secs)));
			wdBox.appendChild(E('p', [
				wd.enabled
					? btn(_('Disable watchdog'), 'cbi-button-negative', function() { run(['watchdog', 'disable']); })
					: btn(_('Enable watchdog'), 'cbi-button-apply', function() { run(['watchdog', 'enable']); })
			]));
		}

		function drawAdd() {
			while (addBox.firstChild) addBox.removeChild(addBox.firstChild);
			addBox.appendChild(E('h3', _('Add WAN connection')));
			if (cands.length) {
				var sel = E('select', { 'class': 'cbi-input-select', 'style': 'margin-right:.5em' },
					cands.map(function(c) {
						return E('option', { value: c.name }, c.name + (c.proto ? ' (' + c.proto + ')' : ''));
					}));
				addBox.appendChild(E('p', [
					sel,
					btn(_('Add to list'), 'cbi-button-add', function() { run(['add', sel.value]); })
				]));
				addBox.appendChild(E('p', { 'style': 'color:#999' },
					_('The interface is added at the lowest priority, and put in the wan firewall zone if needed.')));
			} else {
				addBox.appendChild(E('p', _('No other interfaces available. Create the interface first in Network \u2192 Interfaces (unique name, a protocol such as DHCP client, and a device), then press Refresh.')));
			}
		}

		function draw() {
			while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
			while (warn.firstChild) warn.removeChild(warn.firstChild);
			var names = list.map(function(x) { return x.name; });

			var inuse = list.filter(function(x) { return x.active; })[0];
			if (list.length && inuse && inuse.name !== list[0].name) {
				warn.appendChild(E('div', { 'class': 'alert-message warning' },
					_('Configured primary is %s, but traffic is currently using %s (is the primary down?).')
						.format(list[0].name, inuse.name)));
			} else if (list.length && !inuse) {
				warn.appendChild(E('div', { 'class': 'alert-message warning' },
					_('No default route found.')));
			}

			list.forEach(function(r, i) {
				var up = names.slice(), down = names.slice(), first = names.slice();
				if (i > 0) { up[i] = names[i - 1]; up[i - 1] = names[i]; }
				if (i < names.length - 1) { down[i] = names[i + 1]; down[i + 1] = names[i]; }
				first.splice(i, 1);
				first.unshift(r.name);

				var state = !r.enabled
					? E('span', { 'style': 'color:#999' }, _('Disabled'))
					: r.up
						? E('strong', { 'style': 'color:#2e9d4f' }, _('Up'))
						: E('strong', { 'style': 'color:#cc3d3d' }, _('Down'));

				var use = r.active
					? E('strong', { 'style': 'color:#2e9d4f' }, '\u25CF ' + _('IN USE'))
					: E('span', { 'style': 'color:#999' }, '-');

				tbody.appendChild(E('tr', { 'class': 'tr' }, [
					E('td', { 'class': 'td' }, String(i + 1) + (i === 0 ? ' (primary)' : '')),
					E('td', { 'class': 'td' }, r.name),
					E('td', { 'class': 'td' }, r.dev),
					E('td', { 'class': 'td' }, r.ip),
					E('td', { 'class': 'td' }, String(r.metric)),
					E('td', { 'class': 'td' }, state),
					E('td', { 'class': 'td' }, use),
					E('td', { 'class': 'td' }, [
						btn(_('Make primary'), 'cbi-button-apply', function() { reorder(first); }, i === 0),
						btn('\u25B2', '', function() { reorder(up); }, i === 0),
						btn('\u25BC', '', function() { reorder(down); }, i === names.length - 1),
						r.enabled
							? btn(_('Disable'), 'cbi-button-negative', function() { run(['disable', r.name]); })
							: btn(_('Enable'), 'cbi-button-action', function() { run(['enable', r.name]); }),
						btn(_('Remove'), 'cbi-button-remove', function() { confirmRemove(r); }, list.length <= 1)
					])
				]));
			});

			drawAdd();
			drawWd();
		}

		draw();

		return E([
			E('h2', _('WAN Order')),
			E('p', _('Metrics follow the priority: 1st = 10, 2nd = 20, and so on. The lowest metric among working interfaces carries the traffic. Changes take a few seconds and drop existing connections.')),
			warn,
			E('div', { 'class': 'table-wrapper', 'style': 'overflow-x:auto' }, [
				E('table', { 'class': 'table' }, [
					E('thead', {}, E('tr', { 'class': 'tr table-titles' }, [
						E('th', { 'class': 'th' }, _('Priority')),
						E('th', { 'class': 'th' }, _('Interface')),
						E('th', { 'class': 'th' }, _('Device')),
						E('th', { 'class': 'th' }, _('IPv4')),
						E('th', { 'class': 'th' }, _('Metric')),
						E('th', { 'class': 'th' }, _('State')),
						E('th', { 'class': 'th' }, _('Traffic')),
						E('th', { 'class': 'th' }, _('Actions'))
					])),
					tbody
				])
			]),
			addBox,
			wdBox,
			E('div', { 'class': 'cbi-section' }, [
				E('p', [
					_('Revert to default order after'), ' ', minutes, ' ',
					_('minutes (0 = stay until changed). Applies to order changes.')
				]),
				E('p', [
					btn(_('Restore default order'), 'cbi-button-action', function() { run(['default']); }),
					btn(_('Save current order as default'), '', function() { run(['savedefault']); }),
					btn(_('Refresh'), '', function() { refresh(); })
				])
			])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
