import { useCallback, useState } from "react";

export default function useCommunityModalState(initialForum = "") {
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [createChallengeOpen, setCreateChallengeOpen] = useState(false);
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const [createReplyOpen, setCreateReplyOpen] = useState(false);
  const [addFriendOpen, setAddFriendOpen] = useState(false);
  const [createRecipeTemplateOpen, setCreateRecipeTemplateOpen] = useState(false);

  const [newGroup, setNewGroup] = useState({ name: "", goal: "", privacy: "invite" });
  const [newChallenge, setNewChallenge] = useState({
    title: "",
    type: "distance",
    target: "",
    durationDays: "7",
  });
  const [newPost, setNewPost] = useState({ title: "", body: "" });
  const [newRecipeTemplate, setNewRecipeTemplate] = useState({
    title: "",
    mealType: "Dinner",
    ingredients: "",
    steps: "",
    prepMinutes: "",
    cookMinutes: "",
    servings: "",
    tags: "",
  });
  const [newPostForum, setNewPostForum] = useState(initialForum);
  const [newReply, setNewReply] = useState({ body: "", parentId: null });
  const [statusDraft, setStatusDraft] = useState("");
  const [statusPosting, setStatusPosting] = useState(false);
  const [newFriendUsername, setNewFriendUsername] = useState("");

  const [editGroupOpen, setEditGroupOpen] = useState(false);
  const [editGroupTarget, setEditGroupTarget] = useState(null);
  const [editGroupForm, setEditGroupForm] = useState({ name: "", goal: "" });

  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    kind: "",
    title: "",
    body: "",
    payload: null,
  });
  const [confirmBusy, setConfirmBusy] = useState(false);

  const openConfirmDialog = useCallback(({ kind, title, body, payload = null }) => {
    setConfirmDialog({ open: true, kind, title, body, payload });
  }, []);

  const closeConfirmDialog = useCallback(() => {
    setConfirmDialog((prev) => {
      if (confirmBusy) return prev;
      return { open: false, kind: "", title: "", body: "", payload: null };
    });
  }, [confirmBusy]);

  return {
    createGroupOpen,
    setCreateGroupOpen,
    createChallengeOpen,
    setCreateChallengeOpen,
    createPostOpen,
    setCreatePostOpen,
    createReplyOpen,
    setCreateReplyOpen,
    addFriendOpen,
    setAddFriendOpen,
    createRecipeTemplateOpen,
    setCreateRecipeTemplateOpen,
    newGroup,
    setNewGroup,
    newChallenge,
    setNewChallenge,
    newPost,
    setNewPost,
    newRecipeTemplate,
    setNewRecipeTemplate,
    newPostForum,
    setNewPostForum,
    newReply,
    setNewReply,
    statusDraft,
    setStatusDraft,
    statusPosting,
    setStatusPosting,
    newFriendUsername,
    setNewFriendUsername,
    editGroupOpen,
    setEditGroupOpen,
    editGroupTarget,
    setEditGroupTarget,
    editGroupForm,
    setEditGroupForm,
    confirmDialog,
    setConfirmDialog,
    confirmBusy,
    setConfirmBusy,
    openConfirmDialog,
    closeConfirmDialog,
  };
}

