import { getScroller, prefersReducedMotion } from '../lib/utils';

/** Fade-and-rise for anything tagged [data-simple-reveal]. */
export function initSimpleReveal() {
  const targets = document.querySelectorAll<HTMLElement>('[data-simple-reveal]');
  if (!targets.length) return;

  if (prefersReducedMotion()) {
    targets.forEach((el) => el.classList.add('is-inview'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-inview');
          observer.unobserve(entry.target);
        }
      });
    },
    { root: getScroller() ?? null, threshold: 0.2 }
  );

  targets.forEach((el) => observer.observe(el));
}

/** The Google Form entry id behind each field, keyed by field name. */
const ENTRIES: Record<string, string> = {
  name: 'entry.353397822',
  email: 'entry.164598628',
  phone: 'entry.374035030',
  help: 'entry.1397449396',
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[\d\s()-]{7,}$/;

export function initContactForm() {
  const form = document.querySelector<HTMLFormElement>('.contact-form');
  if (!form) return;

  const message = form.querySelector<HTMLElement>('.contact-form-message');
  const submit = form.querySelector<HTMLButtonElement>('.contact-submit-btn');

  const setError = (field: Element, text: string) => {
    const wrapper = field.closest('.contact-field');
    const slot = wrapper?.querySelector<HTMLElement>('.contact-field-error');
    wrapper?.classList.toggle('is-invalid', Boolean(text));
    if (slot) slot.textContent = text;
  };

  const validate = () => {
    let valid = true;

    form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[required]').forEach((input) => {
      const value = input.value.trim();
      let error = '';
      if (!value) error = 'This field is required';
      else if (input.type === 'email' && !EMAIL.test(value)) error = 'Enter a valid email address';
      else if (input.type === 'tel' && !PHONE.test(value)) error = 'Enter a valid phone number';
      setError(input, error);
      if (error) valid = false;
    });

    return valid;
  };

  form.addEventListener('input', (e) => setError(e.target as Element, ''));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (message) {
      message.className = 'contact-form-message';
      message.textContent = '';
    }
    if (!validate()) {
      form.querySelector<HTMLElement>('.is-invalid input, .is-invalid textarea')?.focus();
      return;
    }

    const data = new FormData(form);
    const body = new URLSearchParams();
    Object.entries(ENTRIES).forEach(([name, entry]) => {
      body.set(entry, String(data.get(name) ?? '').trim());
    });

    submit?.setAttribute('disabled', 'true');

    try {
      // Google Forms is the backend. It sends no CORS headers, so the reply is
      // opaque: a network failure still throws, but a delivered post can't be
      // read back, and reaching Google is taken as sent.
      await fetch(form.action, { method: 'POST', mode: 'no-cors', body });

      form.reset();
      if (message) {
        message.className = 'contact-form-message is-success';
        message.textContent = "Thank you, I'll go through this and get back to you.";
      }
    } catch {
      if (message) {
        message.className = 'contact-form-message is-error';
        message.textContent = "That didn't send. Please email me directly instead.";
      }
    } finally {
      submit?.removeAttribute('disabled');
    }
  });
}
