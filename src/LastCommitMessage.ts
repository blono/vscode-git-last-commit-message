'use strict';
import * as vscode from 'vscode';
import * as Git from './@types/git';

export class LastCommitMessage {
    _gitAPI: Git.API;
    _config = vscode.workspace.getConfiguration('glcm');

    constructor(context: vscode.ExtensionContext) {
        this._gitAPI = vscode.extensions.getExtension('vscode.git').exports.getAPI(1);
        vscode.commands.registerCommand('glcm.loadLastCommitMessage', () => this.loadLastCommitMessage());
        vscode.commands.registerCommand('glcm.chooseLastCommitMessage', () => this.chooseLastCommitMessage());

        vscode.workspace.onDidChangeConfiguration(() => {
            this._config = vscode.workspace.getConfiguration('glcm');
        })
    }

    async loadLastCommitMessage() {
        this._gitAPI.repositories.forEach(async rep => {
            try {
                const commit = await rep.getCommit(rep.state.HEAD.commit);
                if (commit) {
                    this.setCommitMessageToTextBox(rep, commit);
                }

            } catch (ex) {
            }
        });
    }

    private setCommitMessageToTextBox(rep: Git.Repository, commit: Git.Commit) {
        const isAlreadyTextInInputBox = rep.inputBox.value && rep.inputBox.value.length > 0;
        if (!isAlreadyTextInInputBox || this._config.rewriteAlreadyTypedGitMessage) {
            rep.inputBox.value = commit.message;
        }
    }

    private chooseRepository() {
        if (this._gitAPI.repositories.length == 1) {
            return this._gitAPI.repositories[0];
        } else {
            return this._gitAPI.repositories.find(x => x.ui.selected);
        }
    }

    async chooseLastCommitMessage() {
        const selectedRep = this.chooseRepository();
        if (selectedRep != null) {


            const countOfCommitMessagesToChooseFrom = this._config.countOfCommitMessagesToChooseFrom;
            const commitMessages = [];
            await this.getParentCommitRecursively(0, countOfCommitMessagesToChooseFrom, selectedRep, [selectedRep.state.HEAD.commit], commitMessages);

            vscode.window.showQuickPick(commitMessages, {
                canPickMany: false,
                placeHolder: "Choose commit message"
            }).then(item => {
                if (item) {
                    selectedRep.inputBox.value = item;
                }
            });
        }
    }

    async getParentCommitRecursively(i: number, limit: number, rep: Git.Repository, commitHashes: string[], messages: string[]): Promise<number> {
        if (!commitHashes) {
            return i;
        }

        if (!commitHashes || commitHashes.length == 0) {
            return i;
        }

        for (let index = 0; index < commitHashes.length; index++) {
            if (i >= limit) break;
            const parentCommitHash = commitHashes[index];
            const parentCommit = await rep.getCommit(parentCommitHash);
            if (parentCommit) {
                i++;
                messages.push(parentCommit.message);
                const ranCount = await this.getParentCommitRecursively(i, limit, rep, parentCommit.parents, messages);
                i = i + ranCount;
            }
        }

        return i;
    }

    dispose() {
    }
}
