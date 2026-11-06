export interface UserAuth {
  getUserId(): string;
  getUserName?(): string | Promise<string>;
  getUserEmail?(): string | undefined | Promise<string | undefined>;
  canRead(projectId: string): boolean;
  canWrite(projectId: string): boolean;
}

export const devUserAuth: UserAuth = {
  getUserId: () => 'admin',
  canRead: (_projectId: string) => true,
  canWrite: (_projectId: string) => true,
};
