import { fireEvent, render, screen } from "@testing-library/react";
import TemplatesPanel from "./TemplatesPanel";

function buildProps(overrides = {}) {
  return {
    templateSearch: "",
    setTemplateSearch: jest.fn(),
    setCreateRecipeTemplateOpen: jest.fn(),
    templateTypeFilter: "all",
    setTemplateTypeFilter: jest.fn(),
    templateFocusFilter: "all",
    setTemplateFocusFilter: jest.fn(),
    templateSort: "top",
    setTemplateSort: jest.fn(),
    filteredTemplates: [],
    templateViewMode: "swipe",
    setTemplateViewMode: jest.fn(),
    swipeTemplates: [],
    templateDeckIndex: 0,
    visibleSwipeQueue: [],
    setTemplateDeckIndex: jest.fn(),
    setTemplateDeckDragX: jest.fn(),
    setTemplateDeckAnimating: jest.fn(),
    templateQueueExpanded: false,
    setTemplateQueueExpanded: jest.fn(),
    templateDeckDragX: 0,
    templateDeckAnimating: null,
    handleTemplateDeckPointerDown: jest.fn(),
    handleTemplateDeckPointerMove: jest.fn(),
    handleTemplateDeckPointerEnd: jest.fn(),
    handleTemplateDeckKeyDown: jest.fn(),
    templateRatings: {},
    templateTryCounts: {},
    templateComments: {},
    profiles: {},
    getTemplatePreviewRows: () => [],
    getTemplateMetaBadges: () => [],
    openUserProfile: jest.fn(),
    formatTime: () => "Just now",
    handleTemplateDeckAction: jest.fn(),
    likedTemplates: [],
    handleAddTemplateToMine: jest.fn(),
    renderEmptyState: ({ title }) => <div>{title}</div>,
    templateTriedByMe: {},
    handleRateTemplate: jest.fn(),
    handleTryTemplate: jest.fn(),
    templateCommentDrafts: {},
    setTemplateCommentDrafts: jest.fn(),
    handleCommentTemplate: jest.fn(),
    ...overrides,
  };
}

test("opens create recipe modal action", () => {
  const props = buildProps();
  render(<TemplatesPanel {...props} />);
  fireEvent.click(screen.getByRole("button", { name: /create recipe/i }));
  expect(props.setCreateRecipeTemplateOpen).toHaveBeenCalledWith(true);
});

test("switches to forum mode", () => {
  const props = buildProps();
  render(<TemplatesPanel {...props} />);
  fireEvent.click(screen.getByRole("button", { name: /forum mode/i }));
  expect(props.setTemplateViewMode).toHaveBeenCalledWith("forum");
});

