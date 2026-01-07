import { mergeAttributes } from "@tiptap/core";
import { TiptapImage } from "novel";
import { createLoadingEffectDOM } from "./LoadingImageEffect";

/**
 * Creates a glass effect container with reflective sweep animation
 * Wraps an image element to show a generating effect
 */
function createGlassEffectContainer(img: HTMLImageElement, align?: string, rounded: boolean = true): HTMLDivElement {
  // Inject CSS for diagonal sweep gradient animation if not already present
  if (!document.getElementById("diagonal-sweep-gradient-style")) {
    const style = document.createElement("style");
    style.id = "diagonal-sweep-gradient-style";
    style.textContent = `
      @keyframes diagonalSweep {
        0% {
          transform: translate(-100%, -100%);
        }
        to {
          transform: translate(100%, 100%);
        }
      }
      @keyframes blurPulse {
        0%, to {
          filter: blur(0px);
        }
        50% {
          filter: blur(8px);
        }
      }
      @keyframes unblurReveal {
        0% {
          filter: blur(8px);
          opacity: 0.8;
        }
        100% {
          filter: blur(0px);
          opacity: 1;
        }
      }
      .diagonal-sweep-gradient-container {
        animation: diagonalSweep 4s ease-out infinite;
        will-change: transform;
      }
      .diagonal-sweep-gradient {
        background-image: linear-gradient(135deg, rgba(255, 255, 255, 0) 46%, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0) 54%);
      }
      .bg-blur-pulse {
        animation: blurPulse 3.5s ease-in-out infinite;
        will-change: filter;
      }
      .image-unblur-reveal {
        animation: unblurReveal 0.8s ease-out forwards;
        will-change: filter, opacity;
      }
      @media (prefers-reduced-motion: reduce) {
        .diagonal-sweep-gradient-container {
          animation: none;
        }
        .bg-blur-pulse {
          animation: none;
        }
      }
      /* Ensure glass effect containers respect image alignment */
      .ProseMirror div[data-align="center"] {
        display: block;
        margin: 0.5rem auto;
      }
      .ProseMirror div[data-align="left"] {
        display: block;
        margin: 0.5rem auto 0.5rem 0;
        text-align: left;
      }
      .ProseMirror div[data-align="right"] {
        display: block;
        margin: 0.5rem 0 0.5rem auto;
        text-align: right;
      }
    `;
    document.head.appendChild(style);
  }

  // Create container - lock dimensions to prevent size changes
  const container = document.createElement("div");
  container.style.position = "relative";
  
  // Apply alignment - default to "center" if not specified
  const alignment = align || "center";
  
  // Use block display for center/left/right alignment to match image alignment CSS
  if (alignment === "center" || alignment === "left" || alignment === "right") {
    container.style.display = "block";
    if (alignment === "center") {
      container.style.margin = "0.5rem auto";
    } else if (alignment === "left") {
      container.style.margin = "0.5rem auto 0.5rem 0";
      container.style.textAlign = "left";
    } else if (alignment === "right") {
      container.style.margin = "0.5rem 0 0.5rem auto";
      container.style.textAlign = "right";
    }
  } else {
    // For float-left/float-right, use inline-block
    container.style.display = "inline-block";
  }
  container.style.overflow = "hidden";
  container.style.cursor = "pointer";
  
  // Apply rounded corners styling
  if (rounded === false) {
    container.style.borderRadius = "0";
  } else {
    container.style.borderRadius = "0.5rem"; // rounded-lg equivalent
  }
  
  // Set data-align attribute for CSS targeting (always set, defaults to "center")
  container.setAttribute("data-align", alignment);
  
  // Lock container dimensions to match image dimensions to prevent resizing
  const imgWidth = img.width || img.naturalWidth || img.offsetWidth;
  const imgHeight = img.height || img.naturalHeight || img.offsetHeight;
  
  if (imgWidth && imgHeight) {
    container.style.width = `${imgWidth}px`;
    container.style.height = `${imgHeight}px`;
  } else {
    // If dimensions aren't available yet, wait for image to load
    const setDimensions = () => {
      const width = img.naturalWidth || img.width || img.offsetWidth;
      const height = img.naturalHeight || img.height || img.offsetHeight;
      if (width && height) {
        container.style.width = `${width}px`;
        container.style.height = `${height}px`;
      }
    };
    
    if (img.complete) {
      setDimensions();
    } else {
      img.addEventListener("load", setDimensions, { once: true });
    }
  }

  // Create the reflective sweep overlay
  const sweepOverlay = document.createElement("div");
  sweepOverlay.style.position = "absolute";
  sweepOverlay.style.inset = "0";
  sweepOverlay.style.zIndex = "3";
  sweepOverlay.style.width = "100%";
  sweepOverlay.style.height = "100%";
  sweepOverlay.style.overflow = "hidden";
  sweepOverlay.style.pointerEvents = "none";

  // Container for the gradient that moves (starts at top-left, moves to bottom-right)
  const sweepGradientContainer = document.createElement("div");
  sweepGradientContainer.style.position = "absolute";
  sweepGradientContainer.style.left = "-150%";
  sweepGradientContainer.style.top = "-150%";
  sweepGradientContainer.style.width = "400%";
  sweepGradientContainer.style.height = "400%";
  sweepGradientContainer.className = "diagonal-sweep-gradient-container";

  const sweepGradient = document.createElement("div");
  sweepGradient.style.width = "100%";
  sweepGradient.style.height = "100%";
  sweepGradient.className = "diagonal-sweep-gradient";

  sweepGradientContainer.appendChild(sweepGradient);
  sweepOverlay.appendChild(sweepGradientContainer);
  
  // Clone the image for the blurred background layer with pulsating blur effect
  const blurredImg = img.cloneNode(true) as HTMLImageElement;
  blurredImg.style.position = "absolute";
  blurredImg.style.inset = "0";
  blurredImg.style.zIndex = "0";
  blurredImg.style.width = "100%";
  blurredImg.style.height = "100%";
  blurredImg.style.objectFit = "cover";
  blurredImg.className = "bg-blur-pulse";
  
  // Apply rounded corners to blurred image
  if (rounded === false) {
    blurredImg.style.borderRadius = "0";
  } else {
    blurredImg.style.borderRadius = "0.5rem"; // rounded-lg equivalent
  }

  // Set up the main image - lock dimensions to prevent size changes
  img.style.position = "relative";
  img.style.zIndex = "1";
  img.style.display = "block";
  
  // Apply rounded corners to image
  if (rounded === false) {
    img.style.borderRadius = "0";
  } else {
    img.style.borderRadius = "0.5rem"; // rounded-lg equivalent
  }
  
  // Lock width and height to prevent any size changes
  if (imgWidth && imgHeight) {
    img.style.width = `${imgWidth}px`;
    img.style.height = `${imgHeight}px`;
  } else {
    // Set dimensions when image loads
    const setImgDimensions = () => {
      const width = img.naturalWidth || img.width || img.offsetWidth;
      const height = img.naturalHeight || img.height || img.offsetHeight;
      if (width && height) {
        img.style.width = `${width}px`;
        img.style.height = `${height}px`;
      }
    };
    
    if (img.complete) {
      setImgDimensions();
    } else {
      img.addEventListener("load", setImgDimensions, { once: true });
    }
  }

  // Append elements to container
  container.appendChild(blurredImg);
  container.appendChild(img);
  container.appendChild(sweepOverlay);

  return container;
}

export const AsyncImage = TiptapImage.extend({
  name: "image",
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      ...this.parent?.(),
      status: {
        default: "loaded",
      },
      id: {
        default: null,
      },
      previewSrc: {
        default: null,
      },
      isGenerating: {
        default: false,
      },
      rounded: {
        default: true,
        parseHTML: (element) => {
          const roundedAttr = element.getAttribute("data-rounded");
          return roundedAttr === null ? true : roundedAttr === "true";
        },
        renderHTML: (attributes) => {
          if (attributes.rounded === false) {
            return {
              "data-rounded": "false",
            };
          }
          return {};
        },
      },
      width: {
        default: null,
        parseHTML: (element) => element.getAttribute("width"),
        renderHTML: (attributes) => {
          if (!attributes.width) {
            return {};
          }
          return {
            width: attributes.width,
          };
        },
      },
      height: {
        default: null,
        parseHTML: (element) => element.getAttribute("height"),
        renderHTML: (attributes) => {
          if (!attributes.height) {
            return {};
          }
          return {
            height: attributes.height,
          };
        },
      },
      align: {
        default: "center",
        parseHTML: (element) => element.getAttribute("data-align") || "center",
        renderHTML: (attributes) => {
          if (!attributes.align) {
            return {};
          }
          return {
            "data-align": attributes.align,
          };
        },
      },
    };
  },

  addCommands() {
    return {
      ...this.parent?.(),
      setImageAlignment:
        (alignment: "left" | "center" | "right" | "float-left" | "float-right") =>
        ({
          commands,
        }: {
          commands: { updateAttributes: (nodeType: string, attrs: Record<string, unknown>) => boolean };
        }) => {
          return commands.updateAttributes("image", { align: alignment });
        },
    };
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const { status, previewSrc, src, width, height, isGenerating, rounded } = node.attrs;

      // If status is pending, show loading effect instead of image
      if (status === "pending") {
        const loadingContainer = createLoadingEffectDOM(width, height, node.attrs.align, rounded);
        loadingContainer.style.cursor = "pointer";

        // Add click handler for selection
        loadingContainer.addEventListener("click", () => {
          const pos = getPos();
          if (typeof pos === "number") {
            editor.commands.setNodeSelection(pos);
          }
        });

        return {
          dom: loadingContainer,
          contentDOM: null,
        };
      }

      // For loaded images, show the actual image
      const img = document.createElement("img");
      img.src = src || "";
      img.alt = node.attrs.alt || "";
      img.style.cursor = "pointer";
      img.style.imageRendering = "auto";
      
      // Add data-id attribute for easy lookup
      if (node.attrs.id) {
        img.setAttribute("data-id", node.attrs.id);
      }

      // Apply attributes and lock dimensions to prevent size changes
      if (node.attrs.width) {
        img.width = node.attrs.width;
        img.style.width = `${node.attrs.width}px`;
      }
      if (node.attrs.height) {
        img.height = node.attrs.height;
        img.style.height = `${node.attrs.height}px`;
      }
      if (node.attrs.align) {
        img.setAttribute("data-align", node.attrs.align);
      }
      
      // Apply rounded corners styling
      if (rounded === false) {
        img.style.borderRadius = "0";
      } else {
        img.style.borderRadius = "0.5rem"; // rounded-lg equivalent
      }

      // Add click handler for debugging and selection
      const clickHandler = (e: MouseEvent) => {
        console.log("Image clicked, current selection:", editor.state.selection);
        console.log("Image node:", node);
        console.log("Click event:", e);

        // Try to select the image node directly
        const pos = getPos();
        console.log("Image position:", pos);

        // Select the image node
        editor.commands.setNodeSelection(pos);
        console.log("After setNodeSelection:", editor.state.selection);
      };
      img.addEventListener("click", clickHandler);

      // If generating, wrap in glass effect container
      let domElement: HTMLElement = img;
      let containerElement: HTMLDivElement | null = null;
      if (isGenerating) {
        containerElement = createGlassEffectContainer(img, node.attrs.align, rounded);
        domElement = containerElement;
        // Also add click handler to container
        domElement.addEventListener("click", clickHandler);
      } else {
        // If not generating, ensure dimensions are locked from node attributes
        // This ensures consistent sizing when transitioning from generating to complete
        // Use the same dimensions that were used during generation
        if (width && height) {
          const finalWidth = typeof width === "string" ? parseInt(width, 10) : width;
          const finalHeight = typeof height === "string" ? parseInt(height, 10) : height;
          img.style.width = `${finalWidth}px`;
          img.style.height = `${finalHeight}px`;
          img.width = finalWidth;
          img.height = finalHeight;
        }
        
        // Add unblur reveal animation when transitioning from generating to complete
        // Start with blur to create reveal effect
        if (src) {
          img.style.filter = "blur(8px)";
          img.style.opacity = "0.8";
          img.classList.add("image-unblur-reveal");
          
          // Remove animation class and reset styles after animation completes
          setTimeout(() => {
            img.classList.remove("image-unblur-reveal");
            img.style.filter = "";
            img.style.opacity = "";
          }, 800);
        }
      }

      return {
        dom: domElement,
        contentDOM: null,
        // Update method to prevent DOM recreation - just update the src
        update: (updatedNode) => {
          if (updatedNode.type.name !== "image") {
            return false;
          }
          
          const { status: newStatus, src: newSrc, alt: newAlt, width: newWidth, height: newHeight, isGenerating: newIsGenerating, rounded: newRounded } = updatedNode.attrs;
          
          // If status changed to/from pending, we need to recreate the DOM
          if (status !== newStatus) {
            return false; // Let TipTap recreate the DOM
          }
          
          // If generating state changed, we need to recreate to add/remove glass effect
          // Capture dimensions from container to preserve them
          if (isGenerating !== newIsGenerating && !newIsGenerating) {
            // When transitioning FROM generating TO complete, capture container dimensions
            if (containerElement) {
              const containerWidth = containerElement.style.width || containerElement.offsetWidth + "px";
              const containerHeight = containerElement.style.height || containerElement.offsetHeight + "px";
              
              // Store in node attributes so they're preserved after recreation
              // We'll use these in the next render
              if (containerWidth && containerHeight && newWidth && newHeight) {
                // Use the node's width/height attributes which should match
                // But ensure we use the container's actual rendered size
                const actualImg = containerElement.querySelector("img:not([style*='blur']") as HTMLImageElement;
                if (actualImg) {
                  actualImg.setAttribute("data-final-width", containerWidth);
                  actualImg.setAttribute("data-final-height", containerHeight);
                }
              }
            }
            return false; // Let TipTap recreate the DOM with/without glass effect
          }
          
          // If rounded changed, we need to recreate to update border-radius
          if (rounded !== newRounded) {
            return false; // Let TipTap recreate the DOM with updated rounded styling
          }
          
          // Find the actual img element (might be wrapped in glass container)
          let actualImg = img;
          if (containerElement && containerElement.querySelector) {
            const foundImg = containerElement.querySelector("img:not([style*='blur'])");
            if (foundImg) {
              actualImg = foundImg as HTMLImageElement;
            }
          }
          
          // Update rounded styling if needed
          if (rounded !== undefined) {
            if (rounded === false) {
              actualImg.style.borderRadius = "0";
              if (containerElement) {
                containerElement.style.borderRadius = "0";
              }
            } else {
              actualImg.style.borderRadius = "0.5rem";
              if (containerElement) {
                containerElement.style.borderRadius = "0.5rem";
              }
            }
          }
          
          // Update the image src and attributes
          if (actualImg.src !== newSrc && newSrc) {
            // Preserve locked dimensions before updating src
            const lockedWidth = actualImg.style.width;
            const lockedHeight = actualImg.style.height;
            
            actualImg.src = newSrc;
            
            // Restore locked dimensions after src update
            if (lockedWidth) actualImg.style.width = lockedWidth;
            if (lockedHeight) actualImg.style.height = lockedHeight;
            
            // Also update blurred background image if glass effect is active
            if (isGenerating && containerElement) {
              const blurredImg = containerElement.querySelector("img[style*='blur']") as HTMLImageElement;
              if (blurredImg) {
                blurredImg.src = newSrc;
              }
            }
          }
          if (actualImg.alt !== newAlt && newAlt !== undefined) {
            actualImg.alt = newAlt;
          }
          
          // Don't update width/height attributes if dimensions are locked via styles
          // This prevents size changes during updates
          const hasLockedDimensions = actualImg.style.width || actualImg.style.height;
          if (!hasLockedDimensions) {
            if (newWidth && actualImg.width !== newWidth) {
              actualImg.width = typeof newWidth === "string" ? parseInt(newWidth, 10) : newWidth;
            }
            if (newHeight && actualImg.height !== newHeight) {
              actualImg.height = typeof newHeight === "string" ? parseInt(newHeight, 10) : newHeight;
            }
          }
          
          return true; // DOM was updated, don't recreate
        },
      };
    };
  },

  renderHTML({ HTMLAttributes }) {
    const { status, previewSrc, width, height, ...rest } = HTMLAttributes;
    const src = status === "loaded" ? rest.src : previewSrc || rest.src;

    console.log("AsyncImage renderHTML:", {
      status,
      previewSrc,
      src,
      restSrc: rest.src,
      finalSrc: src,
      width,
      height,
    });

    // If status is pending, return a placeholder div (will be replaced by loading effect in addNodeView)
    if (status === "pending") {
      const style = `display: inline-block; min-width: ${width || 800}px; min-height: ${height || 600}px; width: ${width || 800}px; height: ${height || 600}px;`;
      return [
        "div",
        {
          "data-image-loading": "true",
          "data-image-id": rest.id || "",
          style,
        },
      ];
    }

    // Normal loaded image
    return ["img", mergeAttributes(rest, { src })];
  },
});
