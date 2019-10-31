import { existsSync, readFileSync, statSync } from 'fs';
import { resolve } from 'path';
import { which } from 'shelljs';
import { exec, info, success } from './Cli';

enum PackageManager {
    yarn,
    npm,
}

const packageCache: { [key: string]: { mtime: Date, data: Object } } = {};

export const getPackageManager = (dirPath: string): PackageManager => {
    if (!existsSync(dirPath)) {
        throw new Error('Directory "' + dirPath + '" does not exist');
    }

    if (existsSync(resolve(dirPath, 'yarn.lock'))) {
        return PackageManager.yarn;
    }
    return PackageManager.npm;
}

export const installPackages = async (
    dirPath: string,
    packages: string[] = [],
    verbose: boolean = true,
    dev: boolean = false,
): Promise<string[]> => {
    verbose && info('Installs packages...');
    // Remove already installed packges
    packages = packages.filter(packageName => !hasInstalledPackage(dirPath, packageName, dev));

    if (!packages.length) {
        verbose && success('No package has been installed');
        return packages;
    }

    // Retrieve package manager
    const packageManager = getPackageManager(dirPath);

    // Prepare install command
    let command;
    switch (packageManager) {
        case PackageManager.yarn:
            if (!which('yarn')) {
                throw new Error('Unable to install packages, please install "yarn"');
            }
            command = 'yarn add ' + packages.join(' ') + (dev ? ' --dev ' : '');

        case PackageManager.npm:
            if (!which('npm')) {
                throw new Error('Unable to install packages, please install "npm"');
            }
            command = 'npm install ' + (dev ? ' -D ' : '') + packages.join(' ') + ' --save';
    }

    await exec(command, dirPath);

    verbose && success(packages.length ? 'Package(s) "' + packages.join(', ') + '" have been installed' : 'no package has been installed');
    return packages;
}

export const installDevPackages = (
    dirPath: string,
    devPackages: string[] = [],
    verbose: boolean = true,
): Promise<string[]> => {
    return installPackages(dirPath, devPackages, verbose, true);
}

export const getPackageJson = (dirPath: string): string | null => {
    if (!existsSync(dirPath)) {
        throw new Error('Directory "' + dirPath + '" does not exist');
    }
    const packageJsonPath = resolve(dirPath, 'package.json');

    if (existsSync(packageJsonPath)) {
        return packageJsonPath;
    }
    return null;
}

export const getPackageInfo = (dirPath: string, property: string, encoding = 'utf8') => {
    if (!existsSync(dirPath)) {
        throw new Error('Directory "' + dirPath + '" does not exist');
    }

    const packageJsonPath = getPackageJson(dirPath);

    if (!packageJsonPath) {
        throw new Error('package.json does not exist in directory "' + dirPath + '"');
    }

    const mtime = statSync(packageJsonPath).mtime;

    if (
        packageCache[dirPath]
        && packageCache[dirPath].mtime >= mtime
    ) {
        return packageCache[dirPath].data[property];
    }

    const data = JSON.parse(readFileSync(
        packageJsonPath,
        encoding
    ));

    // Store cache
    packageCache[dirPath] = { mtime, data };
    return data[property];
}

export const hasInstalledPackage = (
    dirPath: string,
    packageName: string,
    dev: boolean = false,
    encoding = 'utf8'
): boolean => {
    const installedPackages = getPackageInfo(
        dirPath,
        dev ? 'devDependencies' : 'dependencies',
        encoding
    );

    return !!(installedPackages && installedPackages[packageName]);
}