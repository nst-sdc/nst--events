/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React, { Suspense } from "react";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  cleanup,
  act,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi, beforeEach, afterEach, beforeAll } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App, ConfigProvider } from "antd";

vi.mock("antd", async (importOriginal) => {
  const antd = (await importOriginal()) as any;
  return {
    ...antd,
    Tooltip: ({ children }: any) => <>{children}</>,
    Dropdown: ({ children, menu }: any) => (
      <div>
        {children}
        <div data-testid="mock-dropdown-menu">
          {menu?.items?.map((item: any, i: number) => (
            <div
              key={item.key || i}
              role="menuitem"
              aria-disabled={item.disabled ? "true" : "false"}
              onClick={item.onClick}
            >
              {item.label}
            </div>
          ))}
        </div>
      </div>
    ),
  };
});

import UserManagementPage from "../app/(app)/admin/users/page";

// --- Mock Data ---
const mockUserId = "user-1";
const mockCurrentUser = {
  id: mockUserId,
  email: "platform@adypu.edu.in",
  global_role: "PLATFORM_ADMIN",
};

const mockStudents = {
  data: [
    {
      id: "student-1",
      normalizedEmail: "s1@adypu.edu.in",
      status: "ACTIVE",
      createdAt: "2024-01-01",
      user: {
        id: "user-s1",
        fullName: "Student One",
        academicProfile: {
          batch: {
            admissionYear: 2024,
            graduationYear: 2028,
            program: { code: "BTECH" },
          },
        },
      },
    },
    {
      id: "student-2",
      normalizedEmail: "revoked@adypu.edu.in",
      status: "REVOKED",
      createdAt: "2024-01-02",
      user: {
        id: "user-s2",
        fullName: "Injora Kumar",
        academicProfile: {
          batch: {
            admissionYear: 2024,
            graduationYear: 2028,
            program: { code: "BTECH" },
          },
        },
      },
    },
  ],
  pagination: {},
};

const mockClubs = {
  data: [
    { id: "club-1", name: "Dev Club", status: "ACTIVE" },
    { id: "club-2", name: "Design Club", status: "ACTIVE" },
  ],
  pagination: { has_more: false },
};

const mockUsers = {
  pages: [
    {
      platform_admin_count: 1,
      data: [
        {
          id: mockUserId,
          email: "platform@adypu.edu.in",
          fullName: "Platform Admin",
          globalRole: "PLATFORM_ADMIN",
          clubMemberships: [],
        },
        {
          id: "user-2",
          email: "faculty@newtonschool.co",
          fullName: "Newton Admin",
          globalRole: "FACULTY_ADMIN",
          clubMemberships: [],
        },
        {
          id: "user-3",
          email: "mentor@newtonschool.co",
          fullName: "Newton Mentor",
          globalRole: "FACULTY_MENTOR",
          clubMemberships: [],
        },
        {
          id: "user-4",
          email: "clubadmin@adypu.edu.in",
          fullName: "Club Admin Adypu",
          globalRole: "STUDENT",
          clubMemberships: [
            {
              id: "mem-1",
              role: "CLUB_ADMIN",
              club: { id: "club-1", name: "Dev Club" },
            },
          ],
        },
        {
          id: "user-5",
          email: "multiclub@adypu.edu.in",
          fullName: "Multi Club Admin",
          globalRole: "STUDENT",
          clubMemberships: [
            {
              id: "mem-2",
              role: "CLUB_ADMIN",
              club: { id: "club-1", name: "Dev Club" },
            },
            {
              id: "mem-3",
              role: "CLUB_ADMIN",
              club: { id: "club-2", name: "Design Club" },
            },
          ],
        },
      ],
      pagination: { next_cursor: null },
    },
  ],
  pageParams: [undefined],
};

// --- Mocks ---
const {
  mockUseCurrentUser,
  mockUseAdminStudents,
  mockUseAdminUsers,
  mockUseAddStudent,
  mockUseRemoveStudent,
  mockUseUpdateUserRole,
  mockUseImportStudents,
  mockUseProvisionUser,
  mockUseClubs,
  mockUseAdminAcademicBatches,
} = vi.hoisted(() => ({
  mockUseCurrentUser: vi.fn(),
  mockUseAdminStudents: vi.fn(),
  mockUseAdminUsers: vi.fn(),
  mockUseAddStudent: vi.fn(),
  mockUseRemoveStudent: vi.fn(),
  mockUseUpdateUserRole: vi.fn(),
  mockUseImportStudents: vi.fn(),
  mockUseProvisionUser: vi.fn(),
  mockUseClubs: vi.fn(),
  mockUseAdminAcademicBatches: vi.fn(),
}));

vi.mock("../hooks/useCurrentUser", () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}));

vi.mock("../hooks/useAdminStudents", () => ({
  useAdminStudents: (...args: any[]) => mockUseAdminStudents(...args),
  useAddStudent: () => mockUseAddStudent(),
  useRemoveStudent: () => mockUseRemoveStudent(),
  useImportStudents: () => mockUseImportStudents(),
}));

vi.mock("../hooks/useUserManagement", () => ({
  useAdminUsers: (...args: any[]) => mockUseAdminUsers(...args),
  useUpdateUserRole: () => mockUseUpdateUserRole(),
  useUpdateUserAcademicBatch: () => ({
    mutate: vi.fn(),
    reset: vi.fn(),
    isPending: false,
  }),
  useProvisionUser: () => mockUseProvisionUser(),
  useRevokeUserSessions: () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  }),
}));

vi.mock("../hooks/useAdminAcademicBatches", () => ({
  useAdminAcademicBatches: (...args: any[]) => mockUseAdminAcademicBatches(...args),
}));

vi.mock("../hooks/useClubs", () => ({
  useClubs: (...args: any[]) => mockUseClubs(...args),
}));

const mockSearchParams = new URLSearchParams();
const mockRouterPush = vi.fn();
const mockPathname = "/admin/users";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush, replace: vi.fn() }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => mockPathname,
}));

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  class IntersectionObserver {
    observe = vi.fn();
    disconnect = vi.fn();
    unobserve = vi.fn();
  }
  Object.defineProperty(window, "IntersectionObserver", {
    writable: true,
    configurable: true,
    value: IntersectionObserver,
  });

  class ResizeObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  }
  Object.defineProperty(window, "ResizeObserver", {
    writable: true,
    configurable: true,
    value: ResizeObserver,
  });
});

beforeEach(() => {
  mockUseCurrentUser.mockReturnValue({
    data: mockCurrentUser,
    isLoading: false,
  });
  mockUseAdminStudents.mockReturnValue({
    data: mockStudents,
    isLoading: false,
  });
  mockUseAdminUsers.mockReturnValue({
    data: mockUsers,
    isLoading: false,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
  });
  mockUseClubs.mockReturnValue({ data: mockClubs, isLoading: false });
  mockUseAdminAcademicBatches.mockReturnValue({ data: [], isLoading: false });

  mockUseAddStudent.mockReturnValue({ mutate: vi.fn(), isPending: false });
  mockUseRemoveStudent.mockReturnValue({ mutate: vi.fn(), isPending: false });
  mockUseUpdateUserRole.mockReturnValue({
    mutate: vi.fn(),
    reset: vi.fn(),
    isPending: false,
  });
  mockUseImportStudents.mockReturnValue({ mutate: vi.fn(), isPending: false });
  mockUseProvisionUser.mockReturnValue({ mutate: vi.fn(), isPending: false });

  mockSearchParams.set("tab", "admin-roles");
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  mockSearchParams.forEach((_, key) => mockSearchParams.delete(key));
  vi.clearAllMocks();
});

const renderWithProviders = async (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  let rendered: any;
  await act(async () => {
    rendered = render(
      <QueryClientProvider client={queryClient}>
        <ConfigProvider>
          <App>
            <Suspense fallback="Loading...">{ui}</Suspense>
          </App>
        </ConfigProvider>
      </QueryClientProvider>,
    );
  });
  return rendered;
};

// ═══════════════════════════════════════════════
// TESTS FOR WEB-54C
// ═══════════════════════════════════════════════

test("1. Admin directory renders platform admin", async () => {
  await renderWithProviders(<UserManagementPage />);
  await waitFor(() => {
    expect(screen.getByText("platform@adypu.edu.in")).toBeInTheDocument();
    const platformAdmins = screen.getAllByText("Platform Admin", {
      selector: "span.font-medium",
    });
    expect(platformAdmins.length).toBeGreaterThan(0);
  });
});

test("2. Admin directory renders faculty admin", async () => {
  await renderWithProviders(<UserManagementPage />);
  await waitFor(() => {
    expect(screen.getByText("faculty@newtonschool.co")).toBeInTheDocument();
    expect(screen.getByText("Faculty Admin")).toBeInTheDocument();
  });
});

test("3. Admin directory renders faculty mentor", async () => {
  await renderWithProviders(<UserManagementPage />);
  await waitFor(() => {
    expect(screen.getByText("mentor@newtonschool.co")).toBeInTheDocument();
    expect(screen.getByText("Faculty Mentor")).toBeInTheDocument();
  });
});

test("4. Admin directory renders club admin", async () => {
  await renderWithProviders(<UserManagementPage />);
  await waitFor(() => {
    expect(screen.getByText("clubadmin@adypu.edu.in")).toBeInTheDocument();
    const clubAdmins = screen.getAllByText("Club Admin", {
      selector: "span.font-medium",
    });
    expect(clubAdmins.length).toBeGreaterThan(0);
  });
});

test("5. Club column is absent", async () => {
  await renderWithProviders(<UserManagementPage />);
  await waitFor(() => {
    const tableHeaders = screen
      .getAllByRole("columnheader")
      .map((th) => th.textContent);
    expect(tableHeaders).toEqual([
      "Name",
      "Email",
      "Administrative Role",
      "Actions",
    ]);
    expect(
      screen.queryByText("Club", { selector: "th" }),
    ).not.toBeInTheDocument();
  });
});

test("6. Club Admin displays contextual club count", async () => {
  await renderWithProviders(<UserManagementPage />);
  await waitFor(() => {
    expect(screen.getByText("· 2 clubs")).toBeInTheDocument();
  });
});

test("6a. Hover/popover displays the correct club name", async () => {
  await renderWithProviders(<UserManagementPage />);
  await waitFor(() => {
    expect(
      screen.getByLabelText("Club Admin. Administrator of Dev Club"),
    ).toBeInTheDocument();
  });

  const clubAdminLabel = screen.getByLabelText(
    "Club Admin. Administrator of Dev Club",
  );
  fireEvent.mouseEnter(clubAdminLabel);

  await waitFor(() => {
    expect(screen.getByText("Club Admin of Dev Club")).toBeInTheDocument();
  });
});

test('7. "Change Academic Batch" action is absent', async () => {
  await renderWithProviders(<UserManagementPage />);
  await waitFor(() => {
    expect(screen.queryByText("Change Academic Batch")).not.toBeInTheDocument();
  });
});

test("8. Self-demotion is disabled for current user", async () => {
  await renderWithProviders(<UserManagementPage />);
  const roleActions = screen.getAllByText(/Change Global Role/i);
  expect(roleActions.length).toBeGreaterThan(0);
  const menuItem = roleActions[0].closest('[role="menuitem"]');
  expect(menuItem?.getAttribute("aria-disabled")).toBe("true");
});

test('9. Club Admin action menu shows "View Club"', async () => {
  await renderWithProviders(<UserManagementPage />);

  await waitFor(() => {
    expect(screen.getAllByText(/View Club/i).length).toBeGreaterThan(0);
  });
});

test("10. Add User Modal triggers correctly", async () => {
  await renderWithProviders(<UserManagementPage />);
  await waitFor(() => {
    const addUserBtn = screen.getByRole("button", { name: "Add User" });
    fireEvent.click(addUserBtn);
  });
  await waitFor(() => {
    expect(screen.getByText("Add Platform User")).toBeInTheDocument();
  });
});

test("11. Add User: Unsupported domain shows error", async () => {
  await renderWithProviders(<UserManagementPage />);
  await waitFor(() =>
    fireEvent.click(screen.getByRole("button", { name: "Add User" })),
  );

  const emailInput = screen.getByPlaceholderText(/faculty@newtonschool.co/);
  fireEvent.change(emailInput, { target: { value: "test@gmail.com" } });

  await waitFor(() => {
    expect(screen.getByText(/Unsupported domain/i)).toBeInTheDocument();
  });
});

test("12. Add User: Newton domain shows Global Role select", async () => {
  await renderWithProviders(<UserManagementPage />);
  await waitFor(() =>
    fireEvent.click(screen.getByRole("button", { name: "Add User" })),
  );

  const emailInput = screen.getByPlaceholderText(/faculty@newtonschool.co/);
  fireEvent.change(emailInput, {
    target: { value: "faculty@newtonschool.co" },
  });

  await waitFor(() => {
    expect(screen.getByText("Global Role")).toBeInTheDocument();
    expect(screen.queryByText("Club")).not.toBeInTheDocument();
  });
});

test("13. Add User: Adypu domain shows Club selection", async () => {
  await renderWithProviders(<UserManagementPage />);
  await waitFor(() =>
    fireEvent.click(screen.getByRole("button", { name: "Add User" })),
  );

  const emailInput = screen.getByPlaceholderText(/faculty@newtonschool.co/);
  fireEvent.change(emailInput, { target: { value: "student@adypu.edu.in" } });

  await waitFor(() => {
    expect(
      screen.getAllByText("Administrative Role").length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      screen.getByText("Club", { selector: "label.block" }),
    ).toBeInTheDocument();
  });
});

test("14. Filter by role - Platform Admin", async () => {
  mockSearchParams.set("role", "PLATFORM_ADMIN");
  await renderWithProviders(<UserManagementPage />);
  await waitFor(() => {
    expect(screen.getAllByText("Platform Admin").length).toBeGreaterThan(0);
    expect(screen.queryByText("Newton Admin")).not.toBeInTheDocument();
  });
});

test("15. Filter by role - Club Admin", async () => {
  mockSearchParams.set("role", "CLUB_ADMIN");
  await renderWithProviders(<UserManagementPage />);
  await waitFor(() => {
    expect(screen.getByText("Club Admin Adypu")).toBeInTheDocument();
    expect(
      screen.queryByText("Platform Admin", { selector: "td span" }),
    ).not.toBeInTheDocument();
  });
});

test("16. Advisory count is displayed", async () => {
  await renderWithProviders(<UserManagementPage />);
  await waitFor(() => {
    expect(screen.getByText("Active Platform Admins: 1")).toBeInTheDocument();
  });
});

test('17. Students tab: Revoked student displays "Reactivate Student" and triggers reactivation on confirm', async () => {
  mockSearchParams.set("tab", "students");
  const mockMutate = vi.fn();
  mockUseAddStudent.mockReturnValue({ mutate: mockMutate, isPending: false });

  await renderWithProviders(<UserManagementPage />);

  await waitFor(() => {
    expect(screen.getByText("revoked@adypu.edu.in")).toBeInTheDocument();
    expect(screen.getByText("Reactivate Student")).toBeInTheDocument();
  });

  const reactivateMenuItem = screen
    .getByText("Reactivate Student")
    .closest('[role="menuitem"]')!;
  fireEvent.click(reactivateMenuItem);

  await waitFor(() => {
    expect(
      screen.getAllByText("Reactivate Student Access?").length,
    ).toBeGreaterThan(0);
  });

  const confirmBtn = screen.getByRole("button", { name: "Reactivate Access" });
  fireEvent.click(confirmBtn);

  await waitFor(() => {
    expect(mockMutate).toHaveBeenCalledWith(
      "revoked@adypu.edu.in",
      expect.any(Object),
    );
  });
});

test('18. Students tab: Active student displays "Remove" in Actions dropdown', async () => {
  mockSearchParams.set("tab", "students");
  await renderWithProviders(<UserManagementPage />);

  await waitFor(() => {
    expect(screen.getByText("s1@adypu.edu.in")).toBeInTheDocument();
    expect(screen.getByText("Remove")).toBeInTheDocument();
  });
});

test("only requests the data required by the active Admin Roles tab", async () => {
  await renderWithProviders(<UserManagementPage />);

  expect(mockUseAdminUsers).toHaveBeenLastCalledWith(
    "",
    "administrators",
    true,
  );
  expect(mockUseAdminStudents).toHaveBeenLastCalledWith("", undefined, false);
  expect(mockUseClubs).toHaveBeenLastCalledWith("", true);
  expect(mockUseAdminAcademicBatches).toHaveBeenLastCalledWith(false);
});

test("only requests the data required by the active Students tab", async () => {
  mockSearchParams.set("tab", "students");
  await renderWithProviders(<UserManagementPage />);

  expect(mockUseAdminUsers).toHaveBeenLastCalledWith("", undefined, false);
  expect(mockUseAdminStudents).toHaveBeenLastCalledWith("", undefined, true);
  expect(mockUseClubs).toHaveBeenLastCalledWith("", false);
  expect(mockUseAdminAcademicBatches).toHaveBeenLastCalledWith(false);
});

test("does not render a user twice when adjacent cursor pages overlap", async () => {
  mockUseAdminUsers.mockReturnValue({
    data: {
      ...mockUsers,
      pages: [
        mockUsers.pages[0],
        {
          ...mockUsers.pages[0],
          data: [mockUsers.pages[0].data[1]],
        },
      ],
    },
    isLoading: false,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
  });

  await renderWithProviders(<UserManagementPage />);

  expect(screen.getAllByText("Newton Admin")).toHaveLength(1);
});
