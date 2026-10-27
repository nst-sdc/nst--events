import React, { act } from 'react';
// @ts-ignore
import { createRoot, Root } from 'react-dom/client';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let currentContainer: HTMLElement | null = null;
let currentRoot: Root | null = null;

export function render(ui: React.ReactElement, options?: any) {
  if (currentRoot) {
    try {
      act(() => {
        currentRoot?.unmount();
      });
    } catch {}
    currentContainer?.remove();
  }

  const container = document.createElement('div');
  document.body.appendChild(container);
  currentContainer = container;

  const root = createRoot(container);
  currentRoot = root;

  let elementToRender = ui;
  if (options?.wrapper) {
    const Wrapper = options.wrapper;
    elementToRender = React.createElement(Wrapper, null, ui);
  }

  act(() => {
    root.render(elementToRender);
  });

  return {
    container,
    unmount: () => {
      try {
        act(() => {
          root.unmount();
        });
      } catch {}
      container.remove();
    },
  };
}

export function renderHook<Result, Props = any>(
  renderCallback: (props: Props) => Result,
  options?: { wrapper?: React.ComponentType<{ children: React.ReactNode }> }
) {
  const result = { current: undefined as unknown as Result };
  function TestComponent(props: any) {
    result.current = renderCallback(props);
    return null;
  }
  const rendered = render(React.createElement(TestComponent), options);
  return {
    result,
    unmount: rendered.unmount,
  };
}


function getTextContent(element: HTMLElement): string {
  return element.textContent || '';
}

function matches(text: string, matcher: string | RegExp | ((text: string) => boolean)): boolean {
  if (typeof matcher === 'string') {
    return text.toLowerCase().includes(matcher.toLowerCase());
  }
  if (matcher instanceof RegExp) {
    return matcher.test(text);
  }
  if (typeof matcher === 'function') {
    return matcher(text);
  }
  return false;
}

function getAllElementsMatching(container: HTMLElement, matcher: string | RegExp | ((text: string) => boolean)): HTMLElement[] {
  const all = Array.from(container.querySelectorAll('*')) as HTMLElement[];
  return all.filter((el) => {
    const text = getTextContent(el).trim();
    if (!matches(text, matcher)) return false;
    const hasChildMatch = Array.from(el.children).some((child) => matches(getTextContent(child as HTMLElement).trim(), matcher));
    return !hasChildMatch;
  });
}

export const screen = {
  getByText: (matcher: string | RegExp | ((text: string) => boolean)) => {
    if (!currentContainer) throw new Error('No component rendered');
    const matched = getAllElementsMatching(currentContainer, matcher);
    if (matched.length === 0) {
      throw new Error(`Unable to find element with text: ${matcher}`);
    }
    return matched[0];
  },
  queryByText: (matcher: string | RegExp | ((text: string) => boolean)) => {
    if (!currentContainer) return null;
    const matched = getAllElementsMatching(currentContainer, matcher);
    return matched.length > 0 ? matched[0] : null;
  },
  getAllByText: (matcher: string | RegExp | ((text: string) => boolean)) => {
    if (!currentContainer) return [];
    return getAllElementsMatching(currentContainer, matcher);
  },
  getAllByTestId: (testId: string) => {
    if (!currentContainer) return [];
    return Array.from(currentContainer.querySelectorAll(`[data-testid="${testId}"], [testid="${testId}"]`)) as HTMLElement[];
  },
  getByTestId: (testId: string) => {
    if (!currentContainer) throw new Error('No component rendered');
    const el = currentContainer.querySelector(`[data-testid="${testId}"], [testid="${testId}"]`) as HTMLElement;
    if (!el) throw new Error(`Unable to find element with testID: ${testId}`);
    return el;
  },
  queryByTestId: (testId: string) => {
    if (!currentContainer) return null;
    return (currentContainer.querySelector(`[data-testid="${testId}"], [testid="${testId}"]`) as HTMLElement) || null;
  },
  findByText: async (matcher: string | RegExp | ((text: string) => boolean), _options?: any, waitOptions?: { timeout?: number }) => {
    const timeout = waitOptions?.timeout || 3000;
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const el = screen.queryByText(matcher);
      if (el) return el;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error(`Timed out waiting for element with text: ${matcher}`);
  },
  getByPlaceholderText: (text: string | RegExp) => {
    if (!currentContainer) throw new Error('No component rendered');
    const inputs = Array.from(currentContainer.querySelectorAll('input, textarea')) as HTMLInputElement[];
    const match = inputs.find((input) => {
      const ph = input.getAttribute('placeholder') || '';
      return typeof text === 'string' ? ph.includes(text) : text.test(ph);
    });
    if (!match) throw new Error(`Unable to find input with placeholder: ${text}`);
    return match;
  },
};

export const fireEvent = {
  press: (element: HTMLElement) => {
    act(() => {
      element.click();
    });
  },
  click: (element: HTMLElement) => {
    act(() => {
      element.click();
    });
  },
  changeText: (element: HTMLElement, text: string) => {
    act(() => {
      const input = element as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set;
      if (setter) {
        setter.call(input, text);
      } else {
        input.value = text;
      }
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));

      const reactPropsKey = Object.keys(input).find((k) => k.startsWith('__reactProps'));
      if (reactPropsKey) {
        const props = (input as any)[reactPropsKey];
        if (props?.onChangeText) {
          props.onChangeText(text);
        }
        if (props?.onChange) {
          props.onChange({ target: { value: text }, nativeEvent: { text } });
        }
      }
    });
  },
};

export async function waitFor<T>(callback: () => T | Promise<T>, options?: { timeout?: number }): Promise<T> {
  const timeout = options?.timeout || 3000;
  const start = Date.now();
  let lastError: any;
  while (Date.now() - start < timeout) {
    try {
      let res: any;
      await act(async () => {
        res = await callback();
      });
      return res;
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 20));
    }
  }
  throw lastError || new Error('Timed out in waitFor');
}
