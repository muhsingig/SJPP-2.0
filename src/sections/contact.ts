import { getScroller, prefersReducedMotion } from '../lib/utils';

type Iti = { isValidNumber(): boolean; getNumber(): string; destroy(): void };

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

async function initPhoneInput(): Promise<Iti | null> {
  const input = document.getElementById('contact-phone') as HTMLInputElement | null;
  if (!input) return null;

  try {
    const [{ default: intlTelInput }] = await Promise.all([
      import('intl-tel-input'),
      import('intl-tel-input/styles'),
    ]);

    return intlTelInput(input, {
      initialCountry: 'in',
      separateDialCode: true,
      // Bundled with the package — avoids a runtime request to an external CDN.
      loadUtilsOnInit: () => import('intl-tel-input/utils'),
    }) as unknown as Iti;
  } catch {
    // The plain tel input still works; only the country picker is lost.
    return null;
  }
}

export async function initContactForm() {
  const form = document.querySelector<HTMLFormElement>('.contact-form');
  if (!form) return;

  const iti = await initPhoneInput();
  const message = form.querySelector<HTMLElement>('.contact-form-message');
  const submit = form.querySelector<HTMLButtonElement>('.contact-submit-btn');

  const setError = (field: HTMLElement, text: string) => {
    const wrapper = field.closest('.contact-field');
    const slot = wrapper?.querySelector<HTMLElement>('.contact-field-error');
    wrapper?.classList.toggle('is-invalid', Boolean(text));
    if (slot) slot.textContent = text;
  };

  const validate = () => {
    let valid = true;

    form.querySelectorAll<HTMLInputElement>('input[required]').forEach((input) => {
      if (input.type === 'tel') return;
      const ok = input.value.trim().length > 0;
      setError(input, ok ? '' : 'This field is required');
      if (!ok) valid = false;
    });

    const phone = form.querySelector<HTMLInputElement>('input[type="tel"]');
    if (phone) {
      const raw = phone.value.trim();
      let phoneError = '';
      if (!raw) phoneError = 'This field is required';
      else if (iti && !iti.isValidNumber()) phoneError = 'Enter a valid phone number';
      else if (!iti && !/^[\d\s+()-]{7,}$/.test(raw)) phoneError = 'Enter a valid phone number';
      setError(phone, phoneError);
      if (phoneError) valid = false;
    }

    return valid;
  };

  form.querySelectorAll<HTMLInputElement>('input').forEach((input) => {
    input.addEventListener('input', () => setError(input, ''));
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (message) {
      message.className = 'contact-form-message';
      message.textContent = '';
    }
    if (!validate()) return;

    const data = new FormData(form);
    if (iti) data.set('phone', iti.getNumber());

    submit?.setAttribute('disabled', 'true');

    try {
      const res = await fetch(form.action, {
        method: 'POST',
        body: data,
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(String(res.status));

      form.reset();
      if (message) {
        message.className = 'contact-form-message is-success';
        message.textContent = "Thank you — I'll be in touch shortly.";
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
