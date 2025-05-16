#npm version patch
version=`node -e 'console.log(require("./package.json").version)'`
echo "version $version"

npm i

# Get curent branch name
current_branch=$(git rev-parse --abbrev-ref HEAD)
remote_name=$(git config --get branch.$current_branch.remote)

## Push commit to git
git add .
git commit -m "version added: ### $version"
git push "$remote_name" "$current_branch"

if [ "$version" != "" ]; then
    git tag -a "$version" -m "`git log -1 --format=%s`"
    git push --tags
    echo "Created a new tag, $version"
    npm publish --access public
fi