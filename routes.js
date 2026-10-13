/* fairdeal.ie: the guided route for complex cases (13 October 2026).
   One rules table, used by the tracker (/my, from the intake answers and the case) and by the HSE form (/form, from the
   answers typed into it). It identifies which route applies, what to check first, and who to ask. It never decides
   eligibility and never gives legal advice; every route ends with the same sentence. The database holds the same
   trigger rules in fd_routes(), so the nursing home can see "needs specialist advice" without ever seeing why.

   FDRoutes.compute(facts) -> array of route keys, in priority order. facts:
     capacity: 'yes' | 'no' | 'unsure' | ''      epa: 'registered' | 'unregistered' | 'none' | ''
     signer_role: '' | 'epa' | 'dmr' | 'committee' | 'child' | ...   (from the form only)
     couple: true/false      both_in_care: true/false/null
     property: ['farm','business','land','other'] or []   farm_cap: true/false/null
     joint: true/false/null  gifts: 'yes' | 'no' | 'unsure' | ''
     refused: true/false     disputed: true/false
   FDRoutes.describe(key, facts) -> { key, title, why, check: [], who, button: {label, href}, pages: [], conflict: '' }
*/
(function (root) {
  var NOT = 'fairdeal.ie is not a solicitor and does not decide eligibility; the HSE decides.';
  var SOLICITOR = ['capacity_none', 'epa_unregistered', 'farm', 'joint', 'gifts'];

  function compute(f) {
    f = f || {};
    var r = [];
    var noCap = f.capacity === 'no' || f.capacity === 'unsure';
    var role = f.signer_role || '';
    // capacity: the safer route wins when the sources disagree (an EPA named on the form but "none" at intake, or the reverse)
    if (noCap || role) {
      if (f.epa === 'registered' || role === 'dmr' || role === 'committee' || (role === 'epa' && f.epa !== 'none' && f.epa !== 'unregistered')) r.push('epa_registered');
      else if (f.epa === 'unregistered') r.push('epa_unregistered');
      else if (noCap) r.push('capacity_none');
    }
    var prop = f.property || [];
    if (prop.indexOf('farm') >= 0 || prop.indexOf('business') >= 0 || f.farm_cap === true) r.push('farm');
    if (f.joint === true) r.push('joint');
    if (f.couple === true) r.push('couple');
    if (f.gifts === 'yes' || f.gifts === 'unsure') r.push('gifts');
    if (f.refused === true || f.disputed === true) r.unshift('appeal');
    return r;
  }

  function conflict(key, f) {
    f = f || {};
    var role = f.signer_role || '';
    if (key === 'capacity_none' && (role === 'epa' || role === 'dmr')) return 'The form names an attorney or representative, but the answers at the start said there was no power of attorney. Check which is true before this goes in: the route below is the safer one if there is none.';
    if (key === 'epa_registered' && f.epa === 'none' && role === 'epa') return 'The form names an attorney under a registered power of attorney, but the answers at the start said there was none. Check which is true; if the power of attorney was never registered, use the Decision Support Service route instead.';
    if (key === 'epa_registered' && role === 'epa' && f.epa === 'unregistered') return 'The form says the attorney acts under a registered power of attorney, but the answers at the start said it was never registered. Check the Decision Support Service letter: an unregistered one cannot be used.';
    return '';
  }

  function describe(key, f) {
    f = f || {};
    var first = f.first_name || 'the applicant';
    var D = {
      capacity_none: {
        title: first + ' cannot sign, and there is no enduring power of attorney',
        why: 'A family member can sign the main Fair Deal application as a "specified person" (for example a son or daughter over 18), so that part need not wait. The nursing home loan is different: it needs someone with legal authority, which means a decision-making representative appointed by the Circuit Court.',
        check: ['Send the main application now, signed by a specified person; State support can start while the court part is dealt with.', 'Ask the GP for a capacity report; the court needs one and it is usually the slowest part.', 'Decide whether the nursing home loan is wanted at all. If not, no court order is needed for Fair Deal.', 'If it is wanted, a solicitor makes the court application; a fixed price is available through fairdeal.ie.'],
        who: 'Solicitor',
        button: { label: 'Ask about a fixed-price capacity application', href: '/care-representative' + (f.county ? '?county=' + encodeURIComponent(f.county) : '') + '#panel' },
        pages: ['Before you start', 'Signing on their behalf', 'Nursing home loan'],
      },
      epa_unregistered: {
        title: 'There is an enduring power of attorney, but it was never registered',
        why: 'An enduring power of attorney only takes effect once it is registered with the Decision Support Service. Until then the attorney cannot sign for ' + first + ', and the HSE will not accept it with the form.',
        check: ['Register it with the Decision Support Service first; a solicitor usually does this, and it needs a medical statement that ' + first + ' now lacks capacity.', 'Meanwhile, a specified person can sign the main application so that it is not held up.', 'Once registered, a copy of the registration goes in with the form for the nursing home loan.'],
        who: 'Decision Support Service, solicitor',
        button: { label: 'Decision Support Service: registering an enduring power of attorney', href: 'https://decisionsupportservice.ie/services/decision-support-arrangements/enduring-power-attorney' },
        pages: ['Before you start', 'Signing on their behalf'],
      },
      epa_registered: {
        title: 'Someone signs for ' + first + ' under a registered power of attorney or a court order',
        why: 'The HSE accepts an attorney under a registered enduring power of attorney, a decision-making representative, or a committee of a ward of court. A copy of the authority must go in with the form, and the same person signs the loan parts.',
        check: ['Put a copy of the registered power of attorney or the court order behind the form.', 'The attorney or representative signs Parts 2B and 4B, and the declaration, in their own name.', 'Check the authority covers property decisions if the nursing home loan is wanted; some do not.'],
        who: 'Support office',
        button: { label: 'What goes in with the form', href: '/fair-deal-documents-checklist' },
        pages: ['Signing on their behalf', 'Who repays the loan'],
      },
      farm: {
        title: 'A family farm or business',
        why: 'Farm and business assets are counted every year unless the three-year cap is applied for at the same time as the main application. The cap needs a family successor who commits in writing to running the farm or business for six years.',
        check: ['Decide now whether to apply for the cap: it goes in with the main application, not afterwards.', 'Name the successor and check they qualify: a family member who will run the farm or business for six years.', 'Have the ownership checked, particularly where the land or the business is held through a company, a partnership or a trust.', 'Get the farm or business valued; the HSE needs a figure and its basis.'],
        who: 'Solicitor, accountant',
        button: { label: 'Read the farm and business guide', href: '/fair-deal-farm-and-business' },
        pages: ['Other property, land or a business', 'Farm or business', 'The family successor'],
      },
      joint: {
        title: 'The home is in joint names, part-owned, or held through a trust or company',
        why: 'Only ' + first + '’s share is assessed, so how the share is stated matters. The nursing home loan needs the written consent of every joint owner, and property held in a trust or a company may not qualify for it at all.',
        check: ['Find the deeds or the Land Registry folio and confirm exactly who owns what share.', 'State the share, not the whole value, on the form.', 'If the loan is wanted, every joint owner signs a consent; a solicitor should check the title first.'],
        who: 'Solicitor',
        button: { label: 'Read the family home guide', href: '/family-home' },
        pages: ['The family home', 'The property for the loan'],
      },
      couple: {
        title: 'A married couple or partners' + (f.both_in_care ? ', both in care' : ''),
        why: 'For a couple, the HSE assesses half of the combined income and assets, so the partner’s details go on the form too. ' + (f.both_in_care ? 'Where both are in care, each needs their own application and each is assessed on half of the combined figures.' : 'The partner living at home keeps the other half, and the three-year cap on the home still applies.'),
        check: ['Gather the partner’s income and savings details as well as ' + first + '’s.', f.both_in_care ? 'Make two applications, one for each, with the same combined figures on both.' : 'Note which assets are in joint names and which are in one name only.', 'If separated or divorced, the HSE may still ask for the former partner’s details; ask the support office before posting.'],
        who: 'Support office',
        button: { label: 'Read the couples guide', href: '/fair-deal-couples' },
        pages: ['Spouse or partner', 'Is the spouse or partner in care?'],
      },
      gifts: {
        title: 'Money, property or land given away or sold in the last five years' + (f.gifts === 'unsure' ? ' (not sure)' : ''),
        why: 'The HSE counts anything transferred in the five years before the application as if ' + first + ' still owned it. Every transfer must be declared with its date and value; leaving one out is the commonest reason an application is reopened later.',
        check: ['List each transfer: what it was, the date, its value at the time and who received it.', 'A site to a son or daughter, money towards a deposit, and a house signed over all count.', 'Where the amounts are large or anyone disputes them, ask a solicitor before posting.'],
        who: 'Support office, solicitor if large',
        button: { label: 'What counts as an asset', href: '/what-counts-as-an-asset-for-fair-deal' },
        pages: ['Property sold or given away'],
      },
      appeal: {
        title: f.disputed ? 'A contribution the family disputes' : 'The application was refused',
        why: 'A decision can be appealed in writing within 40 working days of the date on the decision letter, to the address on the letter. If the HSE only wanted more information, sending it can be quicker than an appeal: ring the support office first and ask.',
        check: ['Write to the appeals address on the letter, within 40 working days of its date.', 'Say exactly what you disagree with and why, and send any papers that support it (a valuation, a bank letter, a medical report).', 'Keep a copy of everything, and send it by registered post or ask for a receipt.'],
        who: 'Appeals office',
        button: { label: 'Read the appeals guide', href: '/how-long-does-fair-deal-take#appeal' },
        pages: [],
      },
    };
    var r = D[key]; if (!r) return null;
    r.key = key; r.not = NOT; r.conflict = conflict(key, f); r.specialist = SOLICITOR.indexOf(key) >= 0;
    return r;
  }

  root.FDRoutes = { compute: compute, describe: describe, NOT: NOT, SOLICITOR: SOLICITOR,
    all: function (f) { return compute(f).map(function (k) { return describe(k, f); }); } };
})(typeof window !== 'undefined' ? window : (typeof module !== 'undefined' ? module.exports : this));
