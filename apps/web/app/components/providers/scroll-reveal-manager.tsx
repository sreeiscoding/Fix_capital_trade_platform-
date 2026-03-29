"use client";

import { useEffect } from "react";

const REVEAL_SELECTOR = ".reveal-up, .reveal-fade";

function isInViewport(element: Element) {
  const rect = element.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

  return rect.top <= viewportHeight * 0.92 && rect.bottom >= 0;
}

export function ScrollRevealManager() {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    document.documentElement.classList.add("motion-observer");

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }

          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      },
      {
        threshold: 0.18,
        rootMargin: "0px 0px -8% 0px"
      }
    );

    const seen = new WeakSet<Element>();

    const registerElements = (elements: Iterable<HTMLElement>) => {
      for (const element of elements) {
        if (seen.has(element)) {
          continue;
        }

        seen.add(element);

        if (isInViewport(element)) {
          element.classList.add("is-visible");
          continue;
        }

        observer.observe(element);
      }
    };

    registerElements(document.querySelectorAll<HTMLElement>(REVEAL_SELECTOR));

    const mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement)) {
            continue;
          }

          const matches: HTMLElement[] = [];
          if (node.matches(REVEAL_SELECTOR)) {
            matches.push(node);
          }

          matches.push(...node.querySelectorAll<HTMLElement>(REVEAL_SELECTOR));
          registerElements(matches);
        }
      }
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    return () => {
      mutationObserver.disconnect();
      observer.disconnect();
      document.documentElement.classList.remove("motion-observer");
      for (const element of document.querySelectorAll<HTMLElement>(REVEAL_SELECTOR)) {
        element.classList.remove("is-visible");
      }
    };
  }, []);

  return null;
}
